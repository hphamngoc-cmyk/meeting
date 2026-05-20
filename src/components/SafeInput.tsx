import React, { useState, useEffect, useRef } from 'react';
import { parseValue } from '../lib/format';

interface SafeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
}

export function SafeInput({ value, onValueChange, ...props }: SafeInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);
  const isFocused = useRef(false);

  useEffect(() => {
    // Only update from parents if composition is not active and not focused
    if (!isComposing.current && !isFocused.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (!isComposing.current) {
      onValueChange(val);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    const finalVal = e.currentTarget.value;
    onValueChange(finalVal);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = true;
    
    // On focus, check if the input is a numeric/formatted field
    // (We parse the displayed/formatted value to standard clean raw format for easy editing)
    const clean = parseValue(e.target.value);
    if (clean !== '' && !isNaN(Number(clean))) {
      setLocalValue(clean);
    }

    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    isComposing.current = false;
    onValueChange(e.target.value);
    
    // Revert to parent's formatted value on blur
    setLocalValue(value);
    
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <input
      {...props}
      value={localValue ?? ''}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

interface SafeTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
}

export function SafeTextarea({ value, onValueChange, ...props }: SafeTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    if (!isComposing.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (!isComposing.current) {
      onValueChange(val);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposing.current = false;
    const finalVal = e.currentTarget.value;
    onValueChange(finalVal);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isComposing.current = false;
    onValueChange(e.target.value);
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <textarea
      {...props}
      value={localValue ?? ''}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
}
