import React, { useState, useMemo } from 'react';
import { Button } from 'antd';

export interface CustomAttributeDef {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface AttributeConstraint {
  sum_min?: number;
  sum_max?: number;
  individual_min?: number;
  individual_max?: number;
}

interface CharacterSheetEditorProps {
  characterName: string;
  attributes: CustomAttributeDef[];
  constraints?: AttributeConstraint | null;
  onSubmit: (attributes: Record<string, number>) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const CharacterSheetEditor: React.FC<CharacterSheetEditorProps> = ({
  characterName,
  attributes,
  constraints,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    attributes.forEach((a) => {
      init[a.name] = a.defaultValue;
    });
    return init;
  });

  const totalSum = useMemo(() => Object.values(values).reduce((s, v) => s + v, 0), [values]);

  // Determine min/max for each attribute
  const attrRange = useMemo(() => {
    const map: Record<string, { min: number; max: number }> = {};
    attributes.forEach((a) => {
      map[a.name] = {
        min: a.min ?? constraints?.individual_min ?? 1,
        max: a.max ?? constraints?.individual_max ?? 20,
      };
    });
    return map;
  }, [attributes, constraints]);

  // Validation
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (constraints?.sum_min && totalSum < constraints.sum_min) {
      errs.push(`属性总和不能低于 ${constraints.sum_min}（当前 ${totalSum}）`);
    }
    if (constraints?.sum_max && totalSum > constraints.sum_max) {
      errs.push(`属性总和不能超过 ${constraints.sum_max}（当前 ${totalSum}）`);
    }
    return errs;
  }, [totalSum, constraints]);

  const isValid = errors.length === 0;

  const handleChange = (name: string, value: number) => {
    const range = attrRange[name];
    const clamped = Math.min(Math.max(value, range.min), range.max);
    setValues((prev) => ({ ...prev, [name]: clamped }));
  };

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(values);
  };

  return (
    <div className="game-panel p-4">
      <h3 className="text-amber-400 font-bold mb-1">📋 {characterName} - 角色属性</h3>
      {constraints && (
        <p className="text-xs text-slate-500 mb-4">
          属性总和限制：
          {constraints.sum_min ?? '—'} ~ {constraints.sum_max ?? '—'}
          {' | '}单项范围：
          {constraints.individual_min ?? '—'} ~ {constraints.individual_max ?? '—'}
        </p>
      )}

      <div className="space-y-3 mb-4">
        {attributes.map((attr) => {
          const range = attrRange[attr.name];
          return (
            <div key={attr.name} className="flex items-center gap-3">
              <label className="text-sm text-slate-400 w-16 shrink-0">{attr.name}</label>
              <input
                type="range"
                min={range.min}
                max={range.max}
                value={values[attr.name] ?? attr.defaultValue}
                onChange={(e) => handleChange(attr.name, Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-amber-400 font-mono text-sm w-8 text-right">
                {values[attr.name] ?? attr.defaultValue}
              </span>
            </div>
          );
        })}
      </div>

      {/* Sum display */}
      <div className={`text-sm mb-3 font-mono ${isValid ? 'text-green-400' : 'text-red-400'}`}>
        属性总和：{totalSum}
        {constraints?.sum_max && <span className="text-slate-600"> / {constraints.sum_max}</span>}
      </div>

      {/* Error messages */}
      {errors.map((err, i) => (
        <p key={i} className="text-xs text-red-400 mb-2">{err}</p>
      ))}

      <div className="flex gap-2">
        {onCancel && (
          <Button onClick={onCancel} block className="!bg-slate-700 !border-slate-600 !text-slate-300 hover:!bg-slate-600">
            取消
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          loading={loading}
          block
          className="!bg-amber-500 !border-amber-500 hover:!bg-amber-400 !font-bold"
        >
          确认角色卡
        </Button>
      </div>
    </div>
  );
};

export default CharacterSheetEditor;
