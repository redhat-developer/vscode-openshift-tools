import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, TextField, Typography } from "@mui/material";
import * as React from 'react';

export function FromExistingGitRepo({ setCurrentView }) {

    function handleNext() {
        // nothing
    };

    return (
        <>
            <div style={{ position: 'relative', marginTop: '5em' }}>
                <Typography variant='h5'>
                    Existing Remote Git Repository
                </Typography>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginTop: '2em' }}>
                    <TextField variant='outlined' label='Link to Git Repository' />
                </div>
                <Accordion className='accordion'>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Advanced Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <TextField
                            id='outlined'
                            label='Git Reference'
                            helperText='Branch, tag, or commit to checkout'>
                        </TextField>
                        <TextField
                            id='outlined'
                            label='Context Directory'
                            helperText='Subdirectory for the source code, used as a context directory for building the component'>
                        </TextField>
                    </AccordionDetails>
                </Accordion>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1em', marginTop: '2em' }}>
                    <Button variant='text' onClick={() => {setCurrentView('home')}}>
                        BACK
                    </Button>
                    <Button variant='contained' onClick={handleNext}>
                        NEXT
                    </Button>
                </div>
            </div>
        </>
    );
}
