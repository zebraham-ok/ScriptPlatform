import React from 'react';
import { Input, Select } from 'antd';
import { SearchOutlined, FireOutlined, ClockCircleOutlined } from '@ant-design/icons';

const TAG_OPTIONS = ['悬疑', '时间循环', '亲情', '武侠', '科幻', '奇幻', '历史', '恐怖', '搞笑', '恋爱'];

export type SortType = 'hot' | 'new' | 'rating';

interface ScriptFilterProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  tag: string | undefined;
  onTagChange: (value: string | undefined) => void;
  sort: SortType;
  onSortChange: (value: SortType) => void;
}

const ScriptFilter: React.FC<ScriptFilterProps> = ({
  keyword, onKeywordChange, tag, onTagChange, sort, onSortChange,
}) => {
  return (
    <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex flex-wrap items-center gap-3 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
      <Input
        prefix={<SearchOutlined className="text-white/50" />}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="搜索剧本..."
        className="!w-48 !bg-white/10 !border-white/20 !text-white !placeholder:text-white/40"
        size="small"
        allowClear
      />
      <Select
        value={tag}
        onChange={onTagChange}
        placeholder="标签筛选"
        className="!w-28 [&_.ant-select-selector]:!bg-white/10 [&_.ant-select-selector]:!border-white/20 [&_.ant-select-selection-placeholder]:!text-white/40 [&_.ant-select-selection-item]:!text-white [&_.ant-select-arrow]:!text-white/50"
        size="small"
        allowClear
        popupClassName="!bg-[#1a1040] !border !border-white/10 [&_.ant-select-item]:!text-white/80 [&_.ant-select-item-option-selected]:!bg-purple-500/20"
        options={TAG_OPTIONS.map((t) => ({ value: t, label: t }))}
      />
      <div className="flex gap-1 ml-auto">
        {(['hot', 'new', 'rating'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSortChange(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              sort === s
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-white/60 hover:text-white border border-transparent'
            }`}
          >
            {s === 'hot' && <><FireOutlined className="mr-1" />热门</>}
            {s === 'new' && <><ClockCircleOutlined className="mr-1" />最新</>}
            {s === 'rating' && <>⭐ 评分</>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScriptFilter;
