import React, { useState } from 'react';

import { makeStyles } from '@material-ui/core/styles';

import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
    item: {
        paddingTop: theme.spacing(2)
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 180,
    },
    error: {
        color: "red"
    }
}));

const ChangeGroupTagDialog = ({ open, setOpen, selected, onResponse }) => {
    const classes = useStyles();

    /* Store state of select dropdown */
    const [status, setStatus] = useState("");
    const [failed, setFailed] = useState(null);
    const [groupTag, setGroupTag] = useState("");

    /* Helper method to send update command -- uses async so we can use 'await' keyword */
    const sendData = async (data) => {

        //uses PATCH endpoint and sends the arguments in the body of the HTTP request
        const result = await fetch("http://localhost:4000/assets", {
            method: "PATCH",
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return result;
    }

    const handleSubmit = (event) => {
        event.preventDefault();

        //setup data object to send based on API docs and required parameters
        const data = {
            assets: selected,
            update: {
                groupTag: groupTag
            }
        }

        sendData(data)
            .then(response => {

                //assume anything less than 300 is a success
                if (response.status < 300) {
                    return response.json();
                } else return null;
            })
            .then(json => {

                //check if we got back null and send response to parent page for snackbar rendering
                if (json) {
                    onResponse("success");
                    handleClose();
                } else {
                    onResponse("error");
                    handleClose();
                }
            })
    }

    //reset dialog to default state on close
    const handleClose = () => {
        setOpen(false);
        setGroupTag("");
        setStatus("");
        setFailed(null);
    }

    return (
        <Dialog open={open} onClose={handleClose} aria-labelledby="change-grouptag-dialog-title">

            <DialogTitle id="change-grouptag-dialog-title">Change Group Tag</DialogTitle>

            <DialogContent>
                <DialogContentText>
                    Changing the group tag of {selected.length} product{selected.length > 1 ? "s" : ""}
                </DialogContentText>

                <div className={classes.item}>
                    <form>
                        {/* Controlled input, get value from state and changes state when it changes */}
                        <TextField 
                        id="group-tag-editor" 
                        label="Group Tag" 
                        variant="outlined"
                        value={groupTag}
                        onChange={(event) => setGroupTag(event.target.value)} />

                        {/* Render a failure message if API returns a response code > 300 */}
                        {failed ? <Typography variant="subtitle1" className={classes.error}>Error submitting change</Typography> : null}
                    </form>
                </div>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} type="submit" color="primary">
                    Submit
                </Button>
            </DialogActions>

        </Dialog>
    );
};

export default ChangeGroupTagDialog;