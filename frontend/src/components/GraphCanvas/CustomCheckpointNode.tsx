import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FlagOutlined } from '@ant-design/icons';

const CustomCheckpointNode: React.FC<NodeProps> = ({ data }) => {
  const isInitial = data.isInitial;
  const isEnd = data.isEnd;
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: isInitial && isEnd ? '#f9f0ff' : isInitial ? '#fff7e6' : isEnd ? '#fff2e8' : '#fff0f6',
        border: isInitial && isEnd ? '2px solid #b37feb' : isInitial ? '2px solid #ffa940' : isEnd ? '2px solid #fa8c16' : '2px solid #ffadd2',
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: isInitial && isEnd ? '0 0 8px rgba(179,127,235,0.4)' : isInitial ? '0 0 8px rgba(255,167,64,0.4)' : isEnd ? '0 0 8px rgba(250,140,22,0.4)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <FlagOutlined style={{ fontSize: 18, color: isInitial && isEnd ? '#722ed1' : isInitial ? '#fa8c16' : isEnd ? '#fa8c16' : '#eb2f96' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {data.label}
          {isInitial && (
            <span style={{ fontSize: 10, color: '#fa8c16', marginLeft: 4 }}>起点</span>
          )}
          {isEnd && (
            <span style={{ fontSize: 10, color: '#fa541c', marginLeft: 4 }}>结局</span>
          )}
        </span>
      </div>
      {data.nodeData?.sceneDescription && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.nodeData.sceneDescription}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomCheckpointNode;
