import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Input, List, Button, Space, Typography, Spin, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';
import MainLayout from './components/Layout/MainLayout';
import CharacterPage from './pages/CharacterPage';
import LocationPage from './pages/LocationPage';
import WorldviewPage from './pages/WorldviewPage';
import PlotPage from './pages/PlotPage';
import ItemPage from './pages/ItemPage';
import MechanicsPage from './pages/MechanicsPage';
import AIPanel from './components/AIPanel/AIPanel';
import { useProjectStore } from './store/useProjectStore';
import { listProjects, createProject, deleteProject } from './api';

const { Text } = Typography;

const App: React.FC = () => {
  const {
    currentPage,
    project,
    projectList,
    setProjectList,
    loadProject,
    setProject,
    clearProject,
  } = useProjectStore();

  const [showSelector, setShowSelector] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listProjects();
      setProjectList(data);
    } catch (e) {
      message.error('获取项目列表失败');
    } finally {
      setLoadingList(false);
    }
  }, [setProjectList]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Show selector on first load if no project
  useEffect(() => {
    if (!project) {
      setShowSelector(true);
    }
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const data = await createProject(newTitle.trim());
      setProject(data);
      setNewTitle('');
      setShowSelector(false);
      message.success('项目创建成功');
    } catch (e) {
      message.error('创建项目失败');
    }
  };

  const handleSelect = async (id: string) => {
    await loadProject(id);
    setShowSelector(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      if (project?.projectId === id) {
        clearProject();
      }
      fetchProjects();
      message.success('项目已删除');
    } catch (e) {
      message.error('删除失败');
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'character':
        return <CharacterPage />;
      case 'location':
        return <LocationPage />;
      case 'worldview':
        return <WorldviewPage />;
      case 'plot':
        return <PlotPage />;
      case 'item':
        return <ItemPage />;
      case 'mechanics':
        return <MechanicsPage />;
      default:
        return null;
    }
  };

  return (
    <>
      <MainLayout onProjectSelect={() => setShowSelector(true)}>
        {renderPage()}
      </MainLayout>

      <AIPanel />

      <Modal
        title="项目列表"
        open={showSelector}
        onCancel={() => {
          if (project) setShowSelector(false);
        }}
        footer={null}
        width={500}
        maskClosable={!!project}
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="新项目标题"
              onPressEnter={handleCreate}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建
            </Button>
          </Space.Compact>
        </div>

        <Spin spinning={loadingList}>
          <List
            dataSource={projectList}
            locale={{ emptyText: '暂无项目' }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="open"
                    type="link"
                    icon={<FolderOpenOutlined />}
                    onClick={() => handleSelect(item.id)}
                  >
                    打开
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确认删除此项目?"
                    onConfirm={() => handleDelete(item.id)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={item.title}
                  description={`ID: ${item.id} | 更新: ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}`}
                />
              </List.Item>
            )}
          />
        </Spin>
      </Modal>
    </>
  );
};

export default App;
