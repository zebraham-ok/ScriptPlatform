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
    <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/30 flex flex-wrap items-center gap-3 bg-slate-900/50 sticky top-0 z-10">
      <Input
        prefix={<SearchOutlined className="text-slate-500" />}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="搜索剧本..."
        className="!w-48 !bg-slate-800 !border-slate-700 !text-white !placeholder:text-slate-500"
        size="small"
        allowClear
      />
      <Select
        value={tag}
        onChange={onTagChange}
        placeholder="标签筛选"
        className="!w-28"
        size="small"
        allowClear
        options={TAG_OPTIONS.map((t) => ({ value: t, label: t }))}
      />
      <div className="flex gap-1 ml-auto">
        {(['hot', 'new', 'rating'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSortChange(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              sort === s
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
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
