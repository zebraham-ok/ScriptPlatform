import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, Input, List, Button, Space, Typography, Spin, message, Popconfirm, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOpenOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import MainLayout from './components/Layout/MainLayout';
import CharacterPage from './pages/CharacterPage';
import LocationPage from './pages/LocationPage';
import WorldviewPage from './pages/WorldviewPage';
import PlotPage from './pages/PlotPage';
import ItemPage from './pages/ItemPage';
import MechanicsPage from './pages/MechanicsPage';
import AIPanel from './components/AIPanel/AIPanel';
import { useProjectStore } from './store/useProjectStore';
import { listProjects, createProject, deleteProject, importProject, login, getToken, setToken, clearToken, getStoredUser, setStoredUser } from './api';

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

  // --- Login state ---
  const [loggedIn, setLoggedIn] = useState(false);
  const [loggedUser, setLoggedUser] = useState<{ username: string; displayName: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // --- Project selector state ---
  const [showSelector, setShowSelector] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [importing, setImporting] = useState(false);

  // Hidden file input for importing project JSON
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (token && user) {
      setLoggedIn(true);
      setLoggedUser(user);
    } else {
      setShowLogin(true);
    }
  }, []);

  // Listen for 401 unauthorized events
  useEffect(() => {
    const handler = () => {
      setLoggedIn(false);
      setLoggedUser(null);
      clearProject();
      setShowLogin(true);
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [clearProject]);

  const fetchProjects = useCallback(async () => {
    if (!loggedIn) return;
    setLoadingList(true);
    try {
      const data = await listProjects();
      setProjectList(data);
    } catch (e) {
      message.error('获取项目列表失败');
    } finally {
      setLoadingList(false);
    }
  }, [loggedIn, setProjectList]);

  useEffect(() => {
    if (loggedIn) {
      fetchProjects();
    }
  }, [loggedIn, fetchProjects]);

  // Show project selector if logged in and no project
  useEffect(() => {
    if (loggedIn && !project) {
      setShowSelector(true);
    }
  }, [loggedIn]);

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) return;
    setLoginLoading(true);
    try {
      const result = await login(loginUsername.trim(), loginPassword);
      setToken(result.token);
      setStoredUser({ username: result.username, displayName: result.displayName });
      setLoggedIn(true);
      setLoggedUser({ username: result.username, displayName: result.displayName });
      setShowLogin(false);
      message.success(`欢迎，${result.displayName}！`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '登录失败';
      message.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
    setLoggedUser(null);
    clearProject();
    setShowLogin(true);
    setShowSelector(false);
    message.info('已退出登录');
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      message.warning('请输入项目标题');
      return;
    }
    try {
      const data = await createProject(newTitle.trim());
      setProject(data);
      setNewTitle('');
      setShowSelector(false);
      message.success('项目创建成功');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '创建项目失败';
      message.error(msg);
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

  // --- Import project ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.json')) {
      message.error('请选择 .json 文件');
      return;
    }

    setImporting(true);
    try {
      // Read file content
      const text = await file.text();
      let jsonData: any;
      try {
        jsonData = JSON.parse(text);
      } catch {
        message.error('JSON 解析失败，请检查文件格式');
        setImporting(false);
        return;
      }

      // Send to backend for import (backend normalizes the data)
      const importedProject = await importProject(jsonData);

      // Set as current project and refresh list
      setProject(importedProject);
      setShowSelector(false);
      await fetchProjects();
      message.success(`项目「${importedProject.title}」导入成功！`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '导入项目失败';
      message.error(msg);
    } finally {
      setImporting(false);
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
      <MainLayout
        onProjectSelect={() => setShowSelector(true)}
        onImportProject={handleImportClick}
        loggedUser={loggedUser}
        onLogout={handleLogout}
      >
        {renderPage()}
      </MainLayout>

      <AIPanel />

      {/* Hidden file input for importing project JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* --- Login Modal --- */}
      <Modal
        title="用户登录"
        open={showLogin}
        closable={false}
        footer={null}
        width={400}
        maskClosable={false}
      >
        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item label="用户名">
            <Input
              prefix={<UserOutlined />}
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password
              prefix={<LockOutlined />}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="请输入密码"
              onPressEnter={handleLogin}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loginLoading}>
            登录
          </Button>
        </Form>
      </Modal>

      {/* --- Project Selector Modal --- */}
      <Modal
        title="项目列表"
        open={showSelector}
        onCancel={() => setShowSelector(false)}
        footer={null}
        width={500}
        maskClosable={true}
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
          <div style={{ marginTop: 8 }}>
            <Button
              icon={<PlusOutlined />}
              loading={importing}
              onClick={handleImportClick}
              block
            >
              从 JSON 文件导入项目
            </Button>
          </div>
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
