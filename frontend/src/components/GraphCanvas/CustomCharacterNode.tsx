import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserOutlined } from '@ant-design/icons';

const CustomCharacterNode: React.FC<NodeProps> = ({ data }) => {
  const displayName = data.nodeData?.name || data.label;
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: '#e6f4ff',
        border: '2px solid #91caff',
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <UserOutlined style={{ fontSize: 18, color: '#1677ff' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</span>
      </div>
      {data.nodeData?.gender && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {data.nodeData.gender}
        </div>
      )}
      {data.nodeData?.description && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.nodeData.description}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomCharacterNode;
