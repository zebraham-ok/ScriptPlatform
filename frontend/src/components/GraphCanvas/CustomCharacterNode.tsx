import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserOutlined, ManOutlined, WomanOutlined } from '@ant-design/icons';

const CustomCharacterNode: React.FC<NodeProps> = ({ data }) => {
  const displayName = data.nodeData?.name || data.label;
  const gender = data.nodeData?.gender;

  const colors = useMemo(() => {
    if (gender === '男') {
      return { background: '#e6f4ff', border: '#1677ff', icon: '#1677ff' };
    }
    if (gender === '女') {
      return { background: '#fff1f0', border: '#ff4d4f', icon: '#ff4d4f' };
    }
    return { background: '#f5f5f5', border: '#d9d9d9', icon: '#8c8c8c' };
  }, [gender]);

  const GenderIcon = gender === '男' ? ManOutlined : gender === '女' ? WomanOutlined : UserOutlined;

  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: colors.background,
        border: `2px solid ${colors.border}`,
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <GenderIcon style={{ fontSize: 18, color: colors.icon }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</span>
      </div>
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
