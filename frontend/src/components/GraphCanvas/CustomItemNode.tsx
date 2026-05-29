import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ToolOutlined } from '@ant-design/icons';

const CustomItemNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: '#fffbe6',
        border: '2px solid #ffe58f',
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <ToolOutlined style={{ fontSize: 18, color: '#faad14' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{data.label}</span>
      </div>
      {data.nodeData?.appearance && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.nodeData.appearance}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomItemNode;
