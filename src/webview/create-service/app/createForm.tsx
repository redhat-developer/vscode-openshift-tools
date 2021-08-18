import 'react-dom';
import * as React from 'react';
import Form from '@rjsf/core';
import { Label } from '@patternfly/react-core';

// import { JSONSchema7 } from 'json-schema';

const log = (type) => console.log.bind(console, type);

export function CreateForm(props) {

    const [baseSchema, setBaseSchema] = React.useState({});
    const [uiSchema, setUiSchema] = React.useState({});
    const [crdDescription, setCrdDescription] = React.useState({} as any);

    window.addEventListener('message', (event: any) => {
        if(event?.data?.action  === 'load') {
            setBaseSchema(event.data.openAPIV3Schema);
            setUiSchema(event.data.uiSchema);
            setCrdDescription(event.data.crdDescription);
        }
    });
    return <div className='form-title'>
        <Label className='label'>Create {crdDescription.displayName}</Label>
        <p className='field-description'>{crdDescription.description}</p>
        <Form
            fields={{
                'TitleField': () => <></>, // to supress object editor title 
                'Labels': () => <></>}} // to suppress Labels field in firs release
            schema={baseSchema} 
            uiSchema={uiSchema}
            onChange={log("changed")}
            onSubmit={log("submitted")}
            onError={log("errors")}
            showErrorList={false}
            liveValidate
        />
    </div>
}