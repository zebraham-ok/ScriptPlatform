import React, { useCallback } from 'react';
import { Layout, Button, Tabs, Space, Typography, Spin } from 'antd';
import {
  ExportOutlined,
  ImportOutlined,
  UserOutlined,
  EnvironmentOutlined,
  BookOutlined,
  NodeIndexOutlined,
  ToolOutlined,
  SettingOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  ShopOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import { exportFullProject } from '../../utils/export';
import type { PageType } from '../../types';


const { Header, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
  onProjectSelect: () => void;
  onImportProject: () => void;
  onGoToPlaza: () => void;
  onQuickStart: () => void;
  onTryPlay: () => void;
  onPublishScript: () => void;
  loggedUser: { username: string; displayName: string } | null;
  onLogout: () => void;
  hasProject: boolean;
}

const tabItems = [
  { key: 'character' as PageType, label: '人物', icon: <UserOutlined /> },
  { key: 'location' as PageType, label: '地点', icon: <EnvironmentOutlined /> },
  { key: 'item' as PageType, label: '物品', icon: <ToolOutlined /> },
  { key: 'worldview' as PageType, label: '世界观', icon: <BookOutlined /> },
  { key: 'plot' as PageType, label: '情节树', icon: <NodeIndexOutlined /> },
  { key: 'mechanics' as PageType, label: '功能', icon: <SettingOutlined /> },
];

const MainLayout: React.FC<MainLayoutProps> = ({
  children, onProjectSelect, onImportProject,
  onGoToPlaza, onQuickStart, onTryPlay, onPublishScript,
  loggedUser, onLogout, hasProject,
}) => {
  const { project, currentPage, setCurrentPage, loading } = useProjectStore();

  const handleTabChange = useCallback(
    (key: string) => {
      setCurrentPage(key as PageType);
    },
    [setCurrentPage]
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          height: 56,
          lineHeight: '56px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Text strong style={{ fontSize: 18, whiteSpace: 'nowrap' }}>
            捕梦剧本编辑平台
          </Text>
          {project && (
            <Text type="secondary" style={{ fontSize: 14 }}>
              {project.title}
            </Text>
          )}
        </div>

        <Tabs
          activeKey={currentPage}
          onChange={handleTabChange}
          items={tabItems.map((item) => ({
            key: item.key,
            label: (
              <span>
                {item.icon} {item.label}
              </span>
            ),
          }))}
          style={{ marginBottom: 0 }}
          size="small"
        />

        <Space>
          {loggedUser && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              <UserOutlined /> {loggedUser.displayName}
            </Text>
          )}
          {/* Game mode entry buttons */}
          <Button
            icon={<ThunderboltOutlined />}
            size="small"
            style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
            onClick={onQuickStart}
          >
            快速开局
          </Button>
          <Button
            icon={<ShopOutlined />}
            size="small"
            onClick={onGoToPlaza}
          >
            广场
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            size="small"
            type="primary"
            disabled={!hasProject}
            onClick={onTryPlay}
          >
            试玩
          </Button>
          <Button
            icon={<CloudUploadOutlined />}
            size="small"
            disabled={!hasProject}
            onClick={onPublishScript}
          >
            发布
          </Button>
          <Button
            icon={<ImportOutlined />}
            size="small"
            onClick={onImportProject}
          >
            导入项目
          </Button>
          <Button onClick={onProjectSelect} size="small">
            项目列表
          </Button>
          <Button
            icon={<ExportOutlined />}
            size="small"
            disabled={!project}
            onClick={() => project && exportFullProject(project)}
          >
            导出完整项目
          </Button>
          <Button
            icon={<LogoutOutlined />}
            size="small"
            onClick={onLogout}
          >
            退出
          </Button>
        </Space>
      </Header>

      <Content style={{ background: '#fff' }}>
        <Spin spinning={loading} tip="加载中...">
          {children}
        </Spin>
      </Content>
    </Layout>
  );
};

export default MainLayout;
