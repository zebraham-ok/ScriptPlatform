import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserOutlined, ManOutlined, WomanOutlined, PlayCircleOutlined } from '@ant-design/icons';

const CustomCharacterNode: React.FC<NodeProps> = ({ data }) => {
  const displayName = data.nodeData?.name || data.label;
  const gender = data.nodeData?.gender;
  const isPlayable = data.nodeData?.isPlayable;
  const maxPlayers = data.nodeData?.maxPlayers;

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
        border: `2px solid ${isPlayable ? '#52c41a' : colors.border}`,
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {isPlayable && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: '#52c41a',
            borderRadius: '50%',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 14, color: '#fff' }} />
        </div>
      )}
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
      {isPlayable && maxPlayers !== undefined && (
        <div style={{ fontSize: 9, color: '#52c41a', marginTop: 2 }}>
          {maxPlayers > 1 ? `👥 ×${maxPlayers}` : '👤 可扮演'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomCharacterNode;
