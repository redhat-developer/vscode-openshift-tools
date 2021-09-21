import 'react-dom';
import * as React from 'react';
import Form, { ISubmitEvent } from '@rjsf/core';
import 'bootstrap/dist/css/bootstrap.min.css';

function onSubmit(e: ISubmitEvent<any>) {
    // disable Create button while service is created
    // extension should send message back to unlock the button in case of failure
    // or close the editor in case of success
    window.vscodeApi.postMessage({
        command: 'create',
        formData: e.formData
    });
}

export function CreateForm(props) {
    let changed = false;
    const [baseSchema, setBaseSchema] = React.useState({});
    const [uiSchema, setUiSchema] = React.useState({});
    const [formData, setFormData] = React.useState({});
    const [crdDescription, setCrdDescription] = React.useState({} as any);

    window.addEventListener('message', (event: any) => {
        if(event?.data?.action  === 'load') {
            setBaseSchema(event.data.openAPIV3Schema);
            setUiSchema(event.data.uiSchema);
            setCrdDescription(event.data.crdDescription);
            setFormData(event.data.formData);
        }
        if(event?.data?.action  === 'error') {
            // unlock Create and cancel button
        }
    });
    return <div className='form-title'>
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
        ><div>
            <button type="submit">Create</button>
            <button type="button" onClick={() => {
                window.vscodeApi.postMessage({
                    command: 'cancel',
                    changed
                })}}>Cancel</button>
        </div>
        </Form>
    </div>
}