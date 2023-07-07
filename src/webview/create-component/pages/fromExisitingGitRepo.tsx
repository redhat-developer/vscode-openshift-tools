import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, Stack, TextField, Typography } from "@mui/material";
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
            <Stack direction='column' spacing={2}>
                <div style={{ marginTop: '2em' }}>
                    <TextField variant='outlined' label='Link to Git Repository' fullWidth />
                </div>
                <Accordion className='accordion'>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Advanced Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack direction='row' spacing={2} width='100%'>
                            <TextField
                                fullWidth
                                id='outlined'
                                label='Git Reference'
                                helperText='Branch, tag, or commit to checkout'>
                            </TextField>
                            <TextField
                                fullWidth
                                id='outlined'
                                label='Context Directory'
                                helperText='Subdirectory for the source code, used as a context directory for building the component'>
                            </TextField>
                        </Stack>
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
            </Stack>
        </>
    );
}
