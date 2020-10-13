const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = 4000;
app.use(cors({
    origin: "http://localhost:3000"
}));
app.use(bodyParser.json());
// app.listen(PORT, function() {
//     console.log("Server is running on Port: " + PORT);
// });

mongoose.connect("mongodb+srv://ser401:ser401@cluster0.bjvvr.mongodb.net/Explore?retryWrites=true&w=majority", {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {


    console.log('MongoDB connected...')
    app.listen(PORT, function () {
        console.log("Server is running on Port: " + PORT);
        
    });
});

app.get("/", async (req, res) => {
    if (req.query.type === "parent") {
        mongoose.connection.db.collection('assembly', (err, collection) => {
            collection.find({ serial: req.query.search }).toArray((err, data) => {
                res.json(data);
            })
        });
    } else {
        mongoose.connection.db.collection('asset', (err, collection) => {
            collection.find({ serial: req.query.search }).toArray((err, data) => {
                res.json(data);
            })
        });
    }
    
})

app.get("/events", async (req, res) => {
        mongoose.connection.db.collection('event_data', (err, collection) => {
            collection.find({
                    productId: req.query.search
                }).toArray((err, data) => {
                res.json(data);
            })
        });

    
})