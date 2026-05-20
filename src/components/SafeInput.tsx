import React, { useState, useEffect, useRef } from 'react';

interface SafeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
}

export function SafeInput({ value, onValueChange, ...props }: SafeInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    // Only update from parents if composition is not active
    if (!isComposing.current) {
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isComposing.current = false;
    onValueChange(e.target.value);
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
