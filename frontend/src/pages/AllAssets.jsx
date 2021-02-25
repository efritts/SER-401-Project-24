import React, { useState, useEffect, useRef } from 'react';

//Internal Components
import Header from '../components/Header'
import CustomTable from '../components/Tables/CustomTable'
import TableToolbar from '../components/Tables/TableToolbar';
import ChipBar from '../components/Tables/ChipBar';

//Dialogs
import AssetFilter from '../components/Dialogs/AssetFilter'
import RetireAssetDialog from '../components/Dialogs/RetireAssetDialog';
import ChangeGroupTagDialog from '../components/Dialogs/ChangeGroupTagDialog';
import ChangeAssignmentDialog from '../components/Dialogs/ChangeAssignmentDialog';
import ChangeOwnershipDialog from '../components/Dialogs/ChangeOwnershipDialog';
import ChangeAssignmentTypeDialog from '../components/Dialogs/AssignmentTypeDialogue';
import AssetEditWarning from '../components/Dialogs/AssetEditWarning';
import CreateAssetDialog from '../components/Dialogs/CreateAssetDialog';
import InvalidSerialsDialog from '../components/Dialogs/InvalidSerialsDialog'

//Material-UI Imports
import FilterListIcon from '@material-ui/icons/FilterList';
import EditIcon from '@material-ui/icons/Edit';
import AddIcon from '@material-ui/icons/Add';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import Container from '@material-ui/core/Container';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import SearchIcon from '@material-ui/icons/Search'
import MapIcon from '@material-ui/icons/Map';
import ListAltIcon from '@material-ui/icons/ListAlt';
import {Divider, Grid} from '@material-ui/core';


//the object fields to get for the table we need, in this case assets
const selectedFields = ["serial", "assetName", "assetType", "owner", "checkedOut", "groupTag"];

const AllAssets = (props) => {

    const [assets, setAssets] = useState([]);
    const [childAssets, setChildAssets] = useState([]);
    const [filters, setFilters] = useState({
        limit: 5
    });
    const [dialogs, setDialogs] = useState({});
    const [selected, setSelected] = useState([]);
    const [invalidSerial, setInvalid] = useState([]);
    const [assetCount, setAssetCount] = useState(0);
    const [activeFilters, setActiveFilters] = useState({});
    const [anchor, setAnchor] = useState(null);
    const [nextDialog, setNext] = useState("");
    const [override, setOverride] = useState(false);
    const [success, setSuccess] = useState({ succeeded: null, message: '' });
    const [listButton, setListButton] = useState(props.listButtonColor);
    const [mapButton, setMapButton] = useState(props.mapButtonColor);

    /* Handles searchbar when enter key is pressed */
    const handleKeyDown = (e) => {
        const value = e.target.value;
        if (e.key === 'Enter') {
            setFilters(s => ({ ...s, search: value }))
        }
    }

    /* Handle floating menu placement for toolbar */
    const handleClick = (event) => {
        setAnchor(event.currentTarget);
    }

    /* Close menu */
    const handleClose = () => {
        setAnchor(null);
    }

    /*Handles the map selection */
    const handleMapSelect=(event)=>{
        props.handleMapSelect();
        setListButton('grey')
        setMapButton('black')
    }

    /*Handles list selection */
    const handleListSelect=(event)=>{
        props.handleListSelect();
        setListButton('black')
        setMapButton('grey')
    }

    /* Check selected items for existing parent */
    const handleMenuClick = (event) => {
        setAnchor(null);
        const children = [];
        setNext(event.target.getAttribute("name"));

        Promise.all(
            selected.map(serial =>
                fetch(`http://localhost:4000/assets/${serial}?project=parentId`)
                    .then(resp => {
                        if (resp.status < 300) {
                            return resp.json()
                        }
                        return null;
                    })
            )
        ).then(jsons => {
            jsons.forEach((item, idx) => {
                if (item) {
                    if (!item.parentId) return;
                    if (!selected.includes(item.parentId)) {
                        children.push(selected[idx]);
                    }
                }
                return;
            })
            setChildAssets(children)
        });

    }

    /* Handles stepping through warning dialog to the actual edit dialog */
    useEffect(() => {
        if (!nextDialog) return;
        if (childAssets.length > 0) {
            setDialogs({ assetEditWarning: true });
        } else {
            setDialogs({ [nextDialog]: true });
        }
    }, [childAssets, nextDialog]);

    /* Successful edit event */
    const onSuccess = (succeeded, message) => {
        if (succeeded) {
            setSelected([]);
            setSuccess({ succeeded: succeeded, message: message });
            setActiveFilters({ ...activeFilters });
        } else {
            setSuccess({ succeeded: succeeded, message: message });
        }
    };

    /**
     * Used for asset creator
     * Runs when some serials could not be provisioned
     * 
     * @param {*} invalidSerials Array of serials that were not able to be created
     */
    const onSemiSuccess = (invalidSerials) => {
        if (invalidSerials.length > 0) {
            setInvalid(invalidSerials);

        }
    }

    /* Opens the invalid serials dialog whenever some serials could not be provisioned */
    useEffect(() => {
        if (invalidSerial.length > 0) {
            setDialogs({ invalid: true });
        }
    }, [invalidSerial])

    /* Filter the results list */
    useEffect(() => {
        //generate the fetch url based on active filters and their keys
        const generateURL = (filters) => {
            let url = "http://localhost:4000/assets";
            const keys = Object.keys(filters);
            keys.forEach((key, idx) => {
                if (idx === 0) {
                    url = `${url}?${key}=${filters[key]}`;
                } else {
                    url = `${url}&${key}=${filters[key]}`;
                }
            });

            return url;
        };

        const urlToFetch = generateURL(filters);
        fetch(urlToFetch)
            .then(response => {
                if (response.status < 300) {
                    return response.json();
                } else {
                    return { data: [], count: [{ count: 0 }] };
                }
            })
            .then(json => {
                setAssets(json.data);
                setAssetCount(json.count[0].count);
            });
    }, [filters]);

      //gets current location for the start of the map
  //*********************************************************** */
  

    /* Reset results page to the first one whenever filters are changed */
    useEffect(() => {
        setFilters(s => ({ ...s, page: 0 }));
    }, [activeFilters])

    return (
        <div className="AssetTableDiv">
        <Header heading="Assets" subheading="View All" />
        <div>
            <CustomTable
                data={assets}
                selectedFields={selectedFields}
                selected={selected}
                setSelected={setSelected}
                filters={filters}
                setFilters={setFilters}
                count={assetCount}
                variant="asset"
                checkboxes={true}
                inactive="assembled">

                <TableToolbar
                    title="All Assets"
                    selected={selected}>


                    {/* Table toolbar icons and menus */}
                    {/* Render main action if no items selected, edit actions if some are selected */}
                    {selected.length > 0 ?
                        <>
                            {/* Edit button */}
                            <IconButton aria-label={"edit"} onClick={handleClick}>
                                <EditIcon />
                            </IconButton>

                            {/* Floating menu for bulk edit actions */}
                            <Menu
                                id="edit-menu"
                                anchorEl={anchor}
                                keepMounted
                                open={Boolean(anchor)}
                                onClose={handleClose}>
                                <MenuItem onClick={handleMenuClick} name="retire">Retire Assets</MenuItem>
                                <MenuItem onClick={handleMenuClick} name="groupTag">Change Group Tag</MenuItem>
                                <MenuItem onClick={handleMenuClick} name="assignee">Reassign</MenuItem>
                                <MenuItem onClick={handleMenuClick} name="owner">Change Owner</MenuItem>
                                <MenuItem onClick={handleMenuClick} name="assignmentType">Change Assignment Type</MenuItem>
                            </Menu>
                        </>
                        :
                        <>
                            {/* Creator button */}
                            <Grid container direction='row' justify="left" xs={2}>
                            <Grid item>
                            <Tooltip title={"Create"}>
                                <IconButton aria-label={"create"} onClick={() => setDialogs({ create: true })}>
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                            </Grid>

                            {/*Map-View/List-View */}
                            
                                <Grid item xs={5}>
                                    <Tooltip title={"Map-View"}>
                                        <IconButton className="AssetMapButton"  aria-label={"Map-View"} style={{color:mapButton}}
                                            //add onClick
                                            onClick={handleMapSelect}
                                        >
                                            <MapIcon/>
                                        </IconButton>
                                    </Tooltip>
                                </Grid>
                            <Grid item xs={1}>
                            {/*    <Divider orientation="vertical" />*/}
                            </Grid>
                            <Grid item xs={1}>
                                <Tooltip title={"List-View"} >
                                    <IconButton className="AssetListButton" aria-label={"List-View"} style={{color:listButton}}
                                        //add onClick
                                        onClick={handleListSelect}
                                    >
                                        <ListAltIcon/>
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                            </Grid>


                            {/* Table searchbar */}
                            <Container className='searchBar' align='right'>
                                <div >
                                    <TextField id="searchBox"
                                        variant="outlined"
                                        size="small"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon />
                                                </InputAdornment>
                                            )
                                        }}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                            </Container>

                            {/* Filter button */}
                            <Tooltip title={"Filter"}>
                                <IconButton aria-label={"filter"} onClick={() => setDialogs({ filter: true })}>
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    }
                </TableToolbar>

                {/* Chips representing all the active filters */}
                <ChipBar
                    activeFilters={activeFilters}
                    setActiveFilters={setActiveFilters}
                    setFilters={setFilters} />

            </CustomTable>

        </div>

        {/* Put all the toolbar dialogs here */}
        <AssetFilter
            open={dialogs["filter"]}
            setOpen={(isOpen) => setDialogs({ filter: isOpen })}
            setActiveFilters={setActiveFilters}
            override={override} />

        <RetireAssetDialog
            open={dialogs["retire"]}
            setOpen={(isOpen) => setDialogs({ retire: isOpen })}
            selected={selected}
            onSuccess={onSuccess}
            override={override} />

        <ChangeGroupTagDialog
            open={dialogs["groupTag"]}
            setOpen={(isOpen) => setDialogs({ groupTag: isOpen })}
            selected={selected}
            onSuccess={onSuccess}
            override={override} />
        <ChangeAssignmentDialog
            open={dialogs["assignee"]}
            setOpen={(isOpen) => setDialogs({ assignee: isOpen })}
            selected={selected}
            onSuccess={onSuccess}
            override={override} />

        <ChangeOwnershipDialog
            open={dialogs["owner"]}
            setOpen={(isOpen) => setDialogs({ owner: isOpen })}
            selected={selected}
            onSuccess={onSuccess}
            override={override} />

        <ChangeAssignmentTypeDialog
            open={dialogs["assignmentType"]}
            setOpen={(isOpen) => setDialogs({ assignmentType: isOpen })}
            selected={selected}
            onSuccess={onSuccess}
            override={override} />

        <CreateAssetDialog
            open={dialogs["create"]}
            setOpen={(isOpen) => setDialogs({ create: isOpen })}
            onSuccess={onSuccess}
            onSemiSuccess={onSemiSuccess} />

        <InvalidSerialsDialog
            open={dialogs["invalid"]}
            setOpen={(isOpen) => setDialogs({ invalid: isOpen })}
            items={invalidSerial} />

        {/* Warning when asset is edited separately from its assembly */}
        <AssetEditWarning
            open={dialogs["assetEditWarning"]}
            setOpen={(isOpen) => setDialogs({ assetEditWarning: isOpen })}
            items={childAssets}
            handleOverride={() => {
                setOverride(true);
                setDialogs({ assetEditWarning: false })
                setDialogs({ [nextDialog]: true })
                setNext("")
                setChildAssets([])
            }}
        />

        {/* Displays success or failure message */}
        <Snackbar open={success.succeeded !== null} autoHideDuration={5000} onClose={() => setSuccess({ succeeded: null, message: '' })} anchorOrigin={{ vertical: "top", horizontal: "center" }} style={{ boxShadow: "1px 2px 6px #5f5f5f", borderRadius: "3px" }}>
            <Alert onClose={() => setSuccess({ succeeded: null, message: '' })} severity={success.succeeded ? "success" : "error"}>
                {success.message}
            </Alert>
        </Snackbar>
    </div>
    )}

export default AllAssets;
