import 'react-dom';
import * as React from 'react';
import Form from '@rjsf/core';
import { JSONSchema7 } from 'json-schema';

const emptySchema: JSONSchema7 = {
  title: "Todo",
  type: "object",
  required: ["title"],
  properties: {
    title: {type: "string", title: "Title", default: "A new task"},
    done: {type: "boolean", title: "Done?", default: false}
  }
};

const log = (type) => console.log.bind(console, type);


export function DynamicForm(props) {

    window.addEventListener('message', (event: any) => {
        if(event?.data?.action  === 'schema') {
            setBaseSchema(event.data.schema);
        }
    });

    const  [baseSchema, setBaseSchema] = React.useState(JSON.stringify(emptySchema));

    const schema = React.useMemo( () => JSON.parse(baseSchema) as JSONSchema7, [baseSchema])
    
  return <Form schema={schema}
            onChange={log("changed")}
            onSubmit={log("submitted")}
            onError={log("errors")}
            liveValidate />;
}