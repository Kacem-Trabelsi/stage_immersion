import React, { useEffect, useState } from "react";
import Select from "react-select";

export type Option = {
  value: string;
  label: string;
};

export interface SelectProps {
  options: Option[];
  defaultValue?: Option;
  value?: Option;
  className?: string;
  styles?: any;
  onChange?: (selectedOption: Option | null) => void;
}

const CommonSelect: React.FC<SelectProps> = ({ options, defaultValue, value, className, onChange }) => {
  const [selectedOption, setSelectedOption] = useState<Option | undefined>(value || defaultValue);

  const handleChange = (option: Option | null) => {
    setSelectedOption(option || undefined);
    if (onChange) {
      onChange(option);
    }
  };
  
  useEffect(() => {
    if (value !== undefined) {
      setSelectedOption(value);
    } else if (defaultValue !== undefined) {
      setSelectedOption(defaultValue);
    }
  }, [value, defaultValue]);

  // Effet pour synchroniser avec les changements de defaultValue
  useEffect(() => {
    if (defaultValue !== undefined) {
      setSelectedOption(defaultValue);
    }
  }, [defaultValue]);
  
  return (
    <Select
     classNamePrefix="react-select"
      className={className}
      // styles={customStyles}
      options={options}
      value={selectedOption}
      onChange={handleChange}
      placeholder="Select"
    />
  );
};

export default CommonSelect;
