/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import Form, { IChangeEvent } from '@rjsf/core';
import Validator from '@rjsf/validator-ajv8';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as React from 'react';
import 'react-dom';

export function CreateForm(props) {
    let changed = false;
    const [baseSchema, setBaseSchema] = React.useState({});
    const [uiSchema, setUiSchema] = React.useState({});
    const [formData, setFormData] = React.useState({});
    const [crdDescription, setCrdDescription] = React.useState({} as any);
    const [step, setStep] = React.useState('ready');

    const onSubmit = (e: IChangeEvent): void => {
        // disable Create button while service is created
        // extension should send message back to unlock the button in case of failure
        // or close the editor in case of success
        setStep('creating');
        setFormData(e.formData);
        window.vscodeApi.postMessage({
            command: 'create',
            formData: e.formData
        });
    }

    window.addEventListener('message', (event: any) => {
        if(event?.data?.action  === 'load') {
            setBaseSchema(event.data.openAPIV3Schema);
            setUiSchema(event.data.uiSchema);
            setCrdDescription(event.data.crdDescription);
            setFormData(event.data.formData);
            setStep('loaded');
        }
        if(event?.data?.action  === 'error') {
            setStep('loaded');
        }
    });
    return <>
        {step === 'ready' && (
            <h2>Loading ....</h2>
        )}

        {(step === 'loaded' || step === 'creating') && (
            <div className='form-title'>
                <h1 className='label'>Create {crdDescription.displayName}</h1>
                <p className='field-description'>{crdDescription.description}</p>
                <Form
                    formData={formData}
                    fields={{
                        'TitleField': () => <></>, // to supress object editor title
                        'Labels': () => <></>}} // to suppress Labels field in first release
                    schema={baseSchema}
                    uiSchema={uiSchema}
                    onChange={()=> {changed = true}}
                    onSubmit={onSubmit}
                    liveValidate
                    disabled={step === 'creating'}
                    showErrorList={false}
                    validator={Validator}
                ><div>
                    <button type="submit" className="btn btn-submit" disabled={step === 'creating'}>Create</button>
                    <button type="button" className="btn btn-submit" disabled={step === 'creating'}onClick={() => {
                        window.vscodeApi.postMessage({
                            command: 'cancel',
                            changed
                        })}}>Cancel</button>
                </div>
                </Form>
            </div>
        )}
    </>;
}
