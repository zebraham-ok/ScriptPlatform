import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { EnvironmentOutlined } from '@ant-design/icons';

const CustomLocationNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: '#f6ffed',
        border: '2px solid #b7eb8f',
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <EnvironmentOutlined style={{ fontSize: 18, color: '#52c41a' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{data.label}</span>
      </div>
      {data.nodeData?.locationType && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {data.nodeData.locationType}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomLocationNode;
