import React, { useCallback } from 'react';
import { Layout, Button, Dropdown, Tabs, Space, Typography, Spin } from 'antd';
import {
  ExportOutlined,
  UserOutlined,
  EnvironmentOutlined,
  BookOutlined,
  NodeIndexOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import { exportFullProject, exportLangGraphState, exportPythonCode } from '../../utils/export';
import type { PageType } from '../../types';
import type { MenuProps } from 'antd';

const { Header, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
  onProjectSelect: () => void;
}

const tabItems = [
  { key: 'character' as PageType, label: '人物', icon: <UserOutlined /> },
  { key: 'location' as PageType, label: '地点', icon: <EnvironmentOutlined /> },
  { key: 'item' as PageType, label: '物品', icon: <ToolOutlined /> },
  { key: 'worldview' as PageType, label: '世界观', icon: <BookOutlined /> },
  { key: 'plot' as PageType, label: '情节树', icon: <NodeIndexOutlined /> },
];

const MainLayout: React.FC<MainLayoutProps> = ({ children, onProjectSelect }) => {
  const { project, currentPage, setCurrentPage, loading } = useProjectStore();

  const handleTabChange = useCallback(
    (key: string) => {
      setCurrentPage(key as PageType);
    },
    [setCurrentPage]
  );

  const exportItems: MenuProps['items'] = [
    {
      key: 'full',
      label: '导出完整项目',
      onClick: () => project && exportFullProject(project),
    },
    {
      key: 'langgraph',
      label: '导出 LangGraph State',
      onClick: () => project && exportLangGraphState(project),
    },
    {
      key: 'python',
      label: '导出 Python 初始化代码',
      onClick: () => project && exportPythonCode(project),
    },
  ];

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
            剧本编辑平台
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
          <Button onClick={onProjectSelect} size="small">
            项目列表
          </Button>
          <Dropdown menu={{ items: exportItems }} disabled={!project}>
            <Button icon={<ExportOutlined />} size="small" disabled={!project}>
              导出
            </Button>
          </Dropdown>
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
