import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import FilterListIcon from '@material-ui/icons/FilterList';
import IconButton from '@material-ui/core/IconButton';
import AssetFilter from '../components/Dialogs/AssetFilter';
import EventFilter from '../components/Dialogs/EventFilter';
import Header from '../components/Header';
import CustomTable from '../components/Tables/CustomTable'
import TableToolbar from '../components/Tables/TableToolbar';
import ChipBar from '../components/Tables/ChipBar';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import useLocalStorage from '../utils/auth/useLocalStorage.hook';






const useStyles = makeStyles((theme) => ({
    root: {
        marginLeft: "10px",
    },
    paper: {
        width: "100%",
    },
    item: {
        padding: "10px",
        marginLeft: "0",
        alignItems: "flex-start",

    },
    center: {
        alignContent: "flex-start",
        marginLeft: "auto",
        marginRight: "auto",
        width: "50%",
        backgroundColor: "white",
        marginBottom: '20px',
        marginTop: '40px',
        
    
    }
   
}));
const AccountDetails = () => {
    const base64url = require('base64url');
    const employeeID = "123456";
    const username = "jsmith";
    const email = "johnsmith@gmail.com";
    const password = "*******";
    const [local, setLocal] = useLocalStorage('user', {});
    const user =  local.firstName + " " + local.lastName;
    const uniqueID = JSON.stringify(local.uniqueId);
    const encodedID = base64url(uniqueID);
    const url = "http://localhost:4000/auth/" + encodedID;
    const [employee, setEmployee] = useState([]); 

    /* Fetch user info */
    useEffect(() => {
        fetch(url)
            .then(response => {
                if (response.status < 300) {
                    return response.json();
                } 
            })
            .then(json => {
                if (json) {
                    setEmployee(json.data);
                }
            });
    }, [url]);

    
	const classes = useStyles();

    return (
        <div >
            <AccountCircleIcon fontSize="large" color="primary"/>
            <Typography variant="h5"  color="primary">{user}</Typography>
            <div className={classes.center}>
                <Grid container>
                	
                	<Grid item xs={3} className={classes.item}>
                         <Typography variant="subtitle1" className={classes.break}>Employee ID:</Typography>
                    </Grid>
                    <Grid item xs={3} className={classes.item}>
                    	<Typography variant="body1">{employeeID}</Typography>
                    </Grid>
                          
                </Grid >

                <Grid container>
                	
                	<Grid item xs={3} className={classes.item}>
                         <Typography variant="subtitle1" className={classes.break}>Username:</Typography>
                    </Grid>
                    <Grid item xs={3} className={classes.item}>
                    	<Typography variant="body1">{username}</Typography>
                    </Grid>
                          
                </Grid >

                <Grid container className={classes.break}>
                	
                	<Grid item xs={3} className={classes.item}>
                         <Typography variant="subtitle1" className={classes.break}>Email:</Typography>
                    </Grid>
                    <Grid item xs={3} className={classes.item}>
                    	<Typography variant="body1">{email}</Typography>
                    </Grid>
                          
                </Grid >

                <Grid container className={classes.break}>
                	
                	<Grid item xs={3} className={classes.item}>
                         <Typography variant="subtitle1" className={classes.break}>Password:</Typography>
                    </Grid>
                    <Grid item xs={3} className={classes.item}>
                    	<Typography variant="body1">{password}</Typography>
                    </Grid>
                          
                </Grid >
            </div>

            <Button variant="contained" color="primary">
            Edit Profile
            </Button>


      


          
        </div>

    )
};

export default AccountDetails;