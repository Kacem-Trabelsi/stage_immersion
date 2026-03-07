import React, { useState } from 'react';
import DefaultEditor from "react-simple-wysiwyg";

interface CommonTextEditorProps {
    defaultValue?: string; // Optional prop for the default value
    onChange?: (value: string) => void; // Optional change handler
}

const CommonTextEditor: React.FC<CommonTextEditorProps> = ({ defaultValue, onChange }) => {
    const [value, setValue] = useState(defaultValue || ""); // Use defaultValue as the initial value

    const handleChange = (e: any) => {
        setValue(e.target.value);
        if (onChange) {
            onChange(e.target.value);
        }
    };

    return (
        <>
            <DefaultEditor value={value} onChange={handleChange} />
        </>
    );
}

export default CommonTextEditor;
