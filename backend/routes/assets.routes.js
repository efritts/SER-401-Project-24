const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { nGrams } = require('mongoose-fuzzy-searching/helpers');
const connection = mongoose.connection;
const Asset = require("../models/asset.model");
const Counter = require("../models/counter.model");
const Event = require("../models/event.model");
const Location = require('../models/location.model');
const AssemblySchema = require('../models/assembly.model');
const sampleAssets = require("../sample_data/sampleAssets.data");
const dateFunctions = require("date-fns");
const decrypt = require('../auth.utils').decrypt;

router.get("/", async (req, res, err) => {
  try {
    let aggregateArray = [];

    //if there are possible filters other than search
    if (req.query) {
      const query = req.query;

      //remove page, limit, search, and sorting params since they do not go in the $match
      const disallowed = ["page", "limit", "search", "sort_by", "order","mapBounds","mapView"];
      const filters = await Object.keys(query)
        .reduce(async (pc, c) => {
          const p = await pc;

          /* MongoDB compares exact dates and times
          If we want to see an entire 24 hours, we much get the start and end times of the given day
          And get everything in between the start and end */
          if (c === "dateCreated" || c === "lastUpdated") {
            const beforeDate = dateFunctions.startOfDay(new Date(parseInt(query[c])));
            const afterDate = dateFunctions.endOfDay(new Date(parseInt(query[c])));

            p["$and"] = [{
              [c]: {
                $gte: beforeDate
              }
            }, {
              [c]: {
                $lte: afterDate
              }
            }];

          } else if (c === "inAssembly") {

            //inAssembly query param allows us to only show assets that are components of the inAssembly name
            const assemblyType = decodeURI(query[c]);
            const assemblySchema = await AssemblySchema.findOne({ name: assemblyType });
            if (Object.keys(assemblySchema).length > 0) {
              if (p["assetName"]) {
                const prev = p["assetName"];
                delete p["assetName"];

                if (p["$and"]) {
                  //find all assets that are not in the exclude array
                  p["$and"] = [...p["$and"], {
                    assetName: {
                      $in: assemblySchema.components,
                      ...prev
                    }
                  }];
                } else {
                  p["$and"] = [
                    {
                      assetName: {
                        $in: assemblySchema.components,
                        ...prev
                      }
                    }
                  ];
                }

              } else {
                p["assetName"] = { $in: assemblySchema.components };
              }
            }

          } else if (c === "isAssembly") {

            //isAssembly query param limits results to only assets who do not have a parentId or whose parent assembly is marked disassembled
            const disassembled = await Asset.find({ assembled: false }, { serial: 1 });
            const disSerials = disassembled.map(item => item.serial);
            p["$or"] = [{ parentId: null }, { parentId: { $in: disSerials } }];

          } else if (c === "exclude") {

            //exclude query param is a stringified array of asset names that should not be included in the results (i.e. Only want to see Gap Subs? exclude will be ["Carrier"..."Landing Sub"... etc])
            const jsonExclude = decodeURI(query[c]);
            const excludeArr = JSON.parse(jsonExclude);

            //since assetName was set earlier we must replace with an $and and keep it
            if (p["assetName"]) {
              const prev = p["assetName"];
              delete p["assetName"];

              if (p["$and"]) {
                //find all assets that are not in the exclude array
                p["$and"] = [...p["$and"], {
                  assetName: {
                    $nin: excludeArr,
                    ...prev
                  }
                }];
              } else {
                p["$and"] = [
                  {
                    assetName: {
                      $nin: excludeArr,
                      ...prev
                    }
                  }
                ];
              }

            } else {
              p["assetName"] = { $nin: excludeArr };
            }

          } else if (!disallowed.includes(c)) {
            //convert the "true" and "false" strings in the query into actual booleans
            if (query[c] === "true") {
              p[c] = true;
            } else if (query[c] === "false") {
              p[c] = false;
            } else if (query[c] === "null") {
              //parentId is taken care of when isAssembly is set so we can ignore it
              if (query.isAssembly && c === "parentId") {
                return pc;
              }
              p[c] = null;
            } else {
              p[c] = query[c];
            }
          }

          return pc;
        }, {});


      if (req.query.search) {
        const searchTerm = req.query.search.replace("-", "");

        //match search and regular filters
        const search = {
          $match: {
            $text: {
              $search: nGrams(searchTerm, null, false).join(' ')
            },
            ...filters
          }
        }

        const confidenceScore = {
          $addFields: {
            confidenceScore: { $meta: "textScore" }
          }
        }

        aggregateArray.push(search);
        aggregateArray.push(confidenceScore)

      } else {

        //match only the regular filters
        const match = {
          $match: {
            ...filters
          }
        };
        aggregateArray.push(match);
      }

    } else {
      const match = {
        $match: {

        }
      };

      aggregateArray.push(match);
    }

    const lookupMatch = {
      $match: {
        $expr: {
          $eq: ["$_id", "$$locId"],
        }
      }
    }

    const lookup = {
      $lookup: {
        'from': Location.collection.name,
        let: { locId: "$deployedLocation" },
        pipeline: [
          lookupMatch,
          {
            $project: {
              _id: 0,
              __v: 0
            }
          }
        ],
        'as': "deployedLocation"
      }
    };

    const locationUnwind = {
      $unwind: {
        path: "$deployedLocation",
        preserveNullAndEmptyArrays: true
      }
    };

    aggregateArray.push(lookup);
    aggregateArray.push(locationUnwind);

    if(req.query.mapView==="true"){
      const boundsArray=(decodeURI(req.query.mapBounds).split(','));
      const inBounds={
         $match: {
        "deployedLocation.coordinates":{
          $geoWithin: {
            //array comes in with [lat,long] but needs to be [long,lat]
             $box: [[parseFloat(boundsArray[1]),parseFloat(boundsArray[0])],
                    [parseFloat(boundsArray[3]),parseFloat(boundsArray[2])]]
                  }
                }
              }
            };
      aggregateArray.push(inBounds);
    }else {
      const match = {
        $match: {

        }
      };

      aggregateArray.push(match);
    }

    if (req.query.sort_by) {
      //default ascending order
      const sortOrder = (req.query.order === 'desc' ? -1 : 1);

      if (req.query.search) {
        const sort = {
          $sort: {
            confidenceScore: -1,
            [req.query.sort_by]: sortOrder
          }
        };
        aggregateArray.push(sort);

      } else {
        const sort = {
          $sort: {
            [req.query.sort_by]: sortOrder
          }
        };
        aggregateArray.push(sort);
      }
    } else {
      if (req.query.search) {
        const sort = {
          $sort: {
            confidenceScore: -1,
          }
        };
        aggregateArray.push(sort);
      } else {
        const sort = {
          $sort: {
            serial: 1
          }
        };
        aggregateArray.push(sort);
      }
    }

    //pagination initial setup
    const skip = {
      $skip: (req.query.page && req.query.limit) ? (parseInt(req.query.page) * parseInt(req.query.limit)) : 0
    }

    //limit to 5 results -- modify later based on pagination
    const limit = {
      $limit: req.query.limit ? parseInt(req.query.limit) : 5
    };

    const group = {
      $facet: {
        count: [{ $count: "count" }],
        data: [skip, limit]
      }
    };
    aggregateArray.push(group);

    //remove irrelevant fields from retrieved objects
    const projection = {
      $project: {
        _id: false,
        'data._id': false,
        'data.__v': false,
        'data.serial_fuzzy': false
      }
    }
    aggregateArray.push(projection);

    const result = await Asset.aggregate(aggregateArray);

    //filter results to determine better or even exact matches
    if (req.query.search) {

      //results are found
      if (result[0].data.length) {

        //if top match is an exact match, return only that one
        if (result[0].data[0].serial.toUpperCase() === req.query.search.toUpperCase()) {
          const exactMatch = [result[0].data[0]];
          res.status(200).json({
            count: [{ count: 1 }],
            data: exactMatch
          });

        } else {
          //if matches are extremely close then only return the close matches
          if (result[0].data[0].confidenceScore > 10) {
            const closeMatches = result[0].data.filter(asset => asset.confidenceScore > 10);
            res.status(200).json({
              count: [{ count: closeMatches.length }],
              data: [...closeMatches]
            });
          } else {
            res.status(200).json(result[0]);
          }
        }

      } else {
        res.status(404).json({
          message: "No assets found in database",
          internalCode: "no_assets_found",
        });
      }

      //return all results found if not a search
    } else {
      if (result[0].data.length) {
        res.status(200).json(result[0]);

      } else {
        res.status(404).json({
          message: "No assets found in database",
          internalCode: "no_assets_found",
        });
      }
    }

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error searching for assets in database",
      internalCode: "asset_search_error"
    });
  }
});

/**
 * Provisions serial numbers and adds default values based on supplied information in request body
 */
router.post('/', async (req, res, err) => {
  try {

    const { serialBase, list, beginRange, endRange, owner, type, assetName } = req.body;
    const invalid = [];
    const username = JSON.parse(decrypt(req.body.user)).employeeId; //get user info for the event document later

    //creating from a list of predefined serials
    if (type === "list") {
      const created = [];
      for (let serial of list) {
        //check if serial already exists and add it to an array to alert the user
        const existingDoc = await Asset.find({ serial: serial });
        if (existingDoc.length) {
          invalid.push(serial);
          continue;
        } else {
          //if not already existing, create it with default info
          const newAsset = new Asset({
            serial: serial,
            assetName: assetName,
            owner: owner,
            assetType: "Asset",
            checkedOut: false,
            dateCreated: Date.now(),
            assignmentType: "Owned",
            retired: false
          });

          await newAsset.save();
          created.push(serial);
        }
      }

      //create event document
      const count = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false });
      const creation = new Event({
        eventType: "Creation",
        eventTime: Date.now(),
        key: `CRE-${count.next}`,
        productIds: created,
        initiatingUser: username,
        eventData: {
          details: `Asset(s) created in system.`
        }
      });

      await creation.save();

      res.status(200).json({
        message: "Successfully created assets",
        invalid: invalid
      })

      //create assets from a specified range
    } else if (type === "range") {
      const beginningSerial = parseInt(beginRange);
      const endingSerial = parseInt(endRange);
      const createdSerials = [];

      for (let i = beginningSerial; i <= endingSerial; i++) {
        const newSerial = serialBase + "" + i;

        //check if serial already exists
        const existing = await Asset.find({ serial: newSerial });
        if (existing.length) {
          invalid.push(newSerial);
        } else {
          const newAsset = new Asset({
            serial: newSerial,
            assetName: assetName,
            owner: owner,
            assetType: "Asset",
            checkedOut: false,
            dateCreated: Date.now(),
            assignmentType: "Owned",
            retired: false
          });

          await newAsset.save();
          createdSerials.push(newSerial)
        }
      }
      const count = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false });
      const creation = new Event({
        eventType: "Creation",
        eventTime: Date.now(),
        key: `CRE-${count.next}`,
        productIds: createdSerials,
        initiatingUser: username,
        eventData: {
          details: `Asset(s) created in system.`
        }
      });
      await creation.save();

      //send back success message with any serials that could not be provisioned
      res.status(200).json({
        message: "Successfully created assets",
        invalid: invalid
      });

    } else {
      res.status(403).json({ message: "Type selection missing", internalCode: "type_selection_missing" });
    }
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Internal server error", internalCode: "internal_server_error" });
  }
});

/* 
 *  Update assets and assemblies with fields along with their children
 *  Allows override option in request body to allow changes to child assets without also updating the parent
 *  Parent is marked incomplete and child is removed from parent assembly
 */
router.patch("/", async (req, res) => {
  try {
    const list = req.body.assets; //list of selected serials from client
    const username = JSON.parse(decrypt(req.body.user));
    const isDisassembly = req.body.disassembly;

    //object from client representing fields to update
    //should really only be one
    const field = req.body.update;
    console.log(field);
    const fieldName = Object.getOwnPropertyNames(field)[0];

    //get all parent assembly documents so we can get their serial and update children
    //searches through array we got from client using $in
    const parentAssemblies = await Asset.find({ serial: { $in: list }, assetType: "Assembly" }).select({ serial: 1 });

    const serials = parentAssemblies.map(obj => obj.serial); //get only the serials of the parent assemblies for comparison later

    //get assets too so we can link to the new event
    let foundAssets = [];
    foundAssets = await Asset.find({ serial: { $in: list }, assetType: "Asset" }).select({ serial: 1, parentId: 1, assetName: 1 });

    /* 
     * Determine whether any children are in the edit request that are part of an assembly
     * But whose parent assembly is not also being updated
     * Keep track of the names, serials, and parent serials so we can update each if necessary
     */
    let missingChildNames = [];
    let missingParentSerials = [];
    let missingChildSerials = [];
    foundAssets.forEach(asset => {
      if (asset.parentId) {
        if (!serials.includes(asset.parentId)) {
          missingChildSerials.push(asset.serial);
          missingChildNames.push(asset.assetName);
          missingParentSerials.push(asset.parentId);
        }
      }
    });

    //updates main assets and assemblies selected
    //See mongoose API docs -- [Model name].updateMany( { filters }, { fields and values to update });
    const ret = await Asset.updateMany({ serial: { $in: list }, assetType: "Assembly" }, { ...field, lastUpdated: Date.now() });

    if (isDisassembly) {
      res.status(205).json({ message: "Successfully marked assembly as disassembled" });
      return;
    }

    //check whether any children are edited apart from their parent
    if (missingParentSerials.length > 0) {

      //remove child and update parent assembly if any are specified
      if (req.body.override) {
        await Asset.updateMany({ serial: { $in: list }, assetType: "Asset" }, {
          parentId: null,
          lastUpdated: Date.now(),
          ...field
        });

        for (const [idx, name] of missingChildNames.entries()) {
          await Asset.updateOne(
            {
              serial: missingParentSerials[idx]
            },
            {
              lastUpdated: Date.now(),
              incomplete: true,
              $push: {
                missingItems: name
              }
            }
          );

          const count = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false });
          const removal = new Event({
            eventType: "Removal of Child Asset",
            eventTime: Date.now(),
            key: `REM-${count.next}`,
            productIds: missingParentSerials[idx],
            initiatingUser: username.employeeId,
            eventData: {
              details: `Removed ${name} from ${missingParentSerials[idx]} and marked incomplete.`
            }
          });

          await removal.save();
        }

        //else only update the children that don't have this problem
      } else {
        const newList = list.filter(item => !missingChildSerials.includes(item));
        await Asset.updateMany({ serial: { $in: newList }, assetType: "Asset" }, { ...field, lastUpdated: Date.now() });
      }
      //else update all assets
    } else {
      await Asset.updateMany({ serial: { $in: list }, assetType: "Asset" }, { ...field, lastUpdated: Date.now() });
    }


    //use parent assemblies we found earlier to get their serials to find children
    let parentSerials = [];
    parentAssemblies.forEach((assembly) => {
      parentSerials.push(assembly.serial);
    });

    //keep track of children too
    let foundChildren = [];

    if (parentSerials.length) {
      foundChildren = await Asset.find({ parentId: { $in: parentSerials }, assetType: "Asset" }).select({ serial: 1 });
      await Asset.updateMany({ parentId: { $in: parentSerials } }, { ...field, lastUpdated: Date.now() });
    }

    //get event type and key beginning -- function declared at bottom of this file
    const eventInfo = getEventType(fieldName);
    const counter = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false }); //get counter and increment for event key

    //make up array of all serials affected
    let allAffectedAssets = [];
    if (foundAssets.length) {

      //if override, then we can use all the found assets
      if (req.body.override) {
        foundAssets.forEach((asset) => {
          allAffectedAssets.push(asset.serial);
        })

        //else filter out as needed
      } else {
        if (missingChildSerials.length) {
          const newList = list.filter(item => !missingChildSerials.includes(item));
          allAffectedAssets = [...allAffectedAssets, ...newList];
        } else {
          foundAssets.forEach((asset) => {
            allAffectedAssets.push(asset.serial);
          })
        }

      }
    }

    if (foundChildren.length) {
      foundChildren.forEach((child) => {
        allAffectedAssets.push(child.serial);
      })
    }

    allAffectedAssets = [...allAffectedAssets, ...parentSerials];

    //generate new event and save
    //TODO: make up eventData is some kind of predefined way
    if (allAffectedAssets.length) {
      const event = new Event({
        eventType: eventInfo[0],
        eventTime: Date.now(),
        key: `${eventInfo[1]}${counter.next}`,
        productIds: allAffectedAssets,
        initiatingUser: username.employeeId,
        eventData: {
          details: `Changed ${allAffectedAssets.length} product(s) ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} to ${field[fieldName]}.`
        }
      });
      await event.save();

      const additionalInfo = (missingChildSerials.length && req.body.override) ? `` : (!req.body.override && missingChildSerials.length) ? `${missingChildSerials.length} of these assets were children of assemblies not in the requested list and were not updated.` : "";
      //use lengths from found arrays to send a response
      res.status(200).json({
        message: `Updated ${req.body.override ? foundAssets.length : foundAssets.length - missingChildSerials.length} regular assets, ${parentSerials.length} assemblies, and ${foundChildren.length} of their children. ${additionalInfo}`,
        key: `${eventInfo[1]}${counter.next}`
      })
    } else {
      res.status(200).json({
        message: `No changes made.`
      })
    }

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error updating assets",
      internal_code: "asset_update_error"
    })
  }
});

/**
 * Get schemas for non-assemblies
 */
router.get('/schemas', async (req, res) => {
  try {
    const results = await AssemblySchema.find({ components: { $exists: false } }).select({ components: 0, _id: 0, __v: 0 })
    res.status(200).json(results);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error getting schemas", internalCode: "asset_schema_fetch_error" });
  }
})

/**
 * Load sample assets into database
 */
router.put("/load", async (req, res) => {
  try {
    sampleAssets.forEach(async (item) => {
      const asset = new Asset({
        ...item,
        dateCreated: Date.now(),
      });
      await asset.save();
    });

    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({
      message: "Error loading sample data into database",
      internal_code: "database_load_error",
    });
  }
});

/**
 * Create a new assembly
 */
router.post('/assembly', async (req, res, err) => {
  try {
    const username = JSON.parse(decrypt(req.body.user)); //get unique user info
    const newAssembly = new Asset({
      serial: req.body.serial,
      assetName: req.body.type,
      missingItems: req.body.missingItems,
      owner: req.body.owner,
      assetType: "Assembly",
      parentId: null,
      dateCreated: Date.now(),
      groupTag: req.body.groupTag,
      checkedOut: false,
      assignmentType: "Owned",
      incomplete: req.body.missingItems.length ? true : false,
      assembled: true,
      retired: false
    });

    await newAssembly.save();

    //find all child assets that already have a parent
    const withParents = await Asset.find({
      serial: {
        $in: req.body.assets
      },
      parentId: {
        $ne: null
      }
    });

    const parentSers = withParents.map(item => item.parentId);
    const assetNames = withParents.map(item => item.assetName);

    //update all assets with the new parent
    await Asset.updateMany({ serial: { $in: req.body.assets } }, { parentId: req.body.serial });

    //update old parents to be missing the item and mark each as incomplete
    let i = 0;
    for (const parent of parentSers) {
      await Asset.updateOne({ serial: parent }, { $push: { missingItems: assetNames[i] }, incomplete: true });
      i++;
    }

    const count = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false });
    const creation = new Event({
      eventType: "Creation",
      eventTime: Date.now(),
      key: `CRE-${count.next}`,
      productIds: [req.body.serial, ...req.body.assets],
      initiatingUser: username.employeeId,
      eventData: {
        details: `Created new assembly with serial ${req.body.serial}`
      }
    });

    await creation.save();

    res.status(200).json({ message: "Successfully created assembly", key: `CRE-${count.next}` });

  }
  catch (err) {
    console.log(err)
    res.status(500).json({
      message: "Error creating assembly",
      interalCode: "assembly_creation_error"
    })
  }
});

/**
 * Update an existing assembly
 */
router.patch('/assembly', async (req, res) => {
  try {
    const { serial, missingItems, assets, user } = req.body;
    const username = JSON.parse(decrypt(user));

    const missing = missingItems ? missingItems : [];

    await Asset.updateOne({ serial: serial, assetType: "Assembly" }, {
      missingItems: missing,
      assembled: true,
      incomplete: missing.length > 0 ? true : false,
      lastUpdated: Date.now()
    });

    const findChildren = await Asset.find({ parentId: serial });
    const missingChildren = findChildren.map(item => item.serial).filter(ser => !assets.includes(ser));

    await Asset.updateMany({ serial: { $in: missingChildren } }, { parentId: null, lastUpdated: Date.now() });

    //find all new children that already have parents
    const withParents = await Asset.find({
      serial: {
        $in: assets
      },
      parentId: {
        $ne: serial
      }
    });

    const parentSers = withParents.map(item => item.parentId);
    const assetNames = withParents.map(item => item.assetName);

    //update children with new parent
    await Asset.updateMany({ serial: { $in: assets } }, { parentId: serial, lastUpdated: Date.now() });

    //update parents to mark incomplete
    let i = 0;
    for (const parent of parentSers) {
      await Asset.updateOne({ serial: parent }, { $push: { missingItems: assetNames[i] }, incomplete: true, lastUpdated: Date.now() });
      i++;
    }

    const eventType = getEventType("assemblyMod");
    const count = await Counter.findOneAndUpdate({ name: "events" }, { $inc: { next: 1 } }, { useFindAndModify: false });

    const uniqueParents = [...new Set(parentSers)];

    const modification = new Event({
      eventType: eventType[0],
      eventTime: Date.now(),
      key: `${eventType[1]}${count.next}`,
      productIds: [req.body.serial, ...req.body.assets, ...uniqueParents],
      initiatingUser: username.employeeId,
      eventData: {
        details: `Updated assembly with serial ${req.body.serial}. Removed children from ${JSON.stringify(uniqueParents)} and added to this assembly.`
      }
    });

    await modification.save();

    res.status(200).json({ message: "Successfully updated assembly" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error updating assembly", internalCode: "assembly_update_error" });
  }
});

/**
 * Load databse with assembly schemas for comparison when creating an assembly
 */
router.put("/assembly/schema", async (req, res) => {
  try {
    const assemblySchemas = [{
      name: "Carrier",
      serializationFormat: "G800-",
      components: [
        "Landing Sub",
        "Crossover Sub",
        "Centralizer",
        "Gap Sub"]
    }, {
      name: "Electronics Probe",
      serializationFormat: "ELP-",
      components: [
        "Pulser",
        "ECAM",
        "Gamma",
        "Directional",
        "Female Rotatable"
      ]
    }, {
      name: "Battery Probe",
      serializationFormat: "BAP-",
      components: [
        "Transmission Rod",
        "Gap Joint",
        "Male Rotatable",
        "Battery Bulkhead"
      ]
    }, {
      name: "Kit Box",
      serializationFormat: "EVO-ONE-",
      components: []
    }, {
      name: "Pulser",
      serializationFormat: "ELP-",
      components: [
        "Motor",
        "Gearbox",
        "Pressure Feedthrough"
      ]
    }];

    for (const item of assemblySchemas) {
      const assembly = new AssemblySchema({
        name: item.name,
        serializationFormat: item.serializationFormat,
        components: item.components
      });
      await assembly.save();
    }

    res.status(200).json({
      message: "success"
    });
  } catch (err) {
    console.log(err);
    res.status(503).json({
      message: "Error loading sample data into database",
      internal_code: "database_load_error",
    });
  }

});

/**
 * Get schemas for assemblies
 */
router.get("/assembly/schema", async (req, res) => {
  let query = {};

  const type = decodeURI(req.query.type);
  const assembly = req.query.assembly;
  const isAll = req.query.all === "true" ? true : req.query.all === "false" ? false : null; //specify whether to retreive one or all schemas
  if (type && !isAll) {
    query.name = type;
  }


  if (assembly === "true" && isAll) {
    query.components = { $exists: true };
  } else {
    if (isAll === false) {
      query.components = { $exists: false };
    }
  }

  try {
    let schema = null;

    if (isAll) {
      schema = await AssemblySchema.find(query).select({
        _id: 0,
        __v: 0,
        components: 0
      });
    } else {
      schema = await AssemblySchema.findOne(query).select({
        _id: 0,
        __v: 0
      });
    }
    if ((isAll && schema.length > 0) || (schema instanceof Object && Object.keys(schema).length > 0)) {
      res.status(200).json(schema);
    } else {
      res.status(404).json({
        message: "Error finding assembly schema",
        internal_code: "schema_error",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(503).json({
      message: "Error finding assembly schema",
      internal_code: "schema_error",
    });
  }
});

/**
 * Retreive a single asset document
 */
router.get("/:serial", async (req, res, err) => {
  const serial = req.params.serial;

  //for mapping
  const map = req.params.map;
  const bounds = req.params.bounds;

  const { project } = req.query
  let projection = {};
  if (project) {
    projection = {
      [project]: 1,
      _id: 0
    }
  }
  try {

    if (map == true) {


    } else {

      const asset = await Asset.find({ serial: serial }, projection).populate('deployedLocation');



      if (asset.length) {
        res.status(200).json(asset[0]);
      } else {
        res.status(404).json({
          message: "No assets found for serial",
          internalCode: "no_assets_found",
        });
      }
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "serial is missing",
      interalCode: "missing_parameters",
    });
  }

});

function getEventType(field) {
  switch (field) {
    case "retired":
      return ["Change of Retirement Status", "RET-"];
    case "groupTag":
      return ["Change of Group Tag", "GRP-"];
    case "assignee":
      return ["Reassignment", "REA-"];
    case "owner":
      return ["Change of Ownership", "OWN-"];
    case "assignmentType":
      return ["Change of Assignment Type", "ASN-"];
    case "creation":
      return ["Creation", "CRE-"];
    case "assemblyMod":
      return ["Assembly Modification", "ABM-"]
  }
}

module.exports = router;
