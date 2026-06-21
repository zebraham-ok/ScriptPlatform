import React, { useState } from 'react';
import { Button, Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined, EditOutlined, PlayCircleOutlined, LoginOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface HomePageProps {
  loggedIn: boolean;
  loggedUser: { username: string; displayName: string } | null;
  onNavigateToCreator: () => void;
  onNavigateToGame: () => void;
  onLoginClick: (targetPage?: 'creator' | 'game') => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  loggedIn,
  loggedUser,
  onNavigateToCreator,
  onNavigateToGame,
  onLoginClick,
  onLogout,
}) => {
  const [hoveredCard, setHoveredCard] = useState<'creator' | 'game' | null>(null);

  const handleNavigate = (type: 'creator' | 'game') => {
    if (!loggedIn) {
      onLoginClick(type);
      return;
    }
    if (type === 'creator') {
      onNavigateToCreator();
    } else {
      onNavigateToGame();
    }
  };

  return (
    <div style={styles.container}>
      {/* Floating particles background */}
      <div style={styles.bgOverlay} />

      {/* Top-right user area */}
      <div style={styles.topBar}>
        {loggedIn && loggedUser ? (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: onLogout,
                },
              ],
            }}
            placement="bottomRight"
          >
            <Button
              type="text"
              style={styles.userBtn}
              icon={
                <Avatar
                  size={28}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#7c5cfc', marginRight: -4 }}
                />
              }
            >
              <Text style={{ color: '#e0d8ff', fontSize: 14, marginLeft: 2 }}>
                {loggedUser.displayName}
              </Text>
            </Button>
          </Dropdown>
        ) : (
          <Button
            type="text"
            icon={<LoginOutlined />}
            onClick={() => onLoginClick()}
            style={styles.loginBtn}
          >
            登录
          </Button>
        )}
      </div>

      {/* Main content */}
      <div style={styles.mainContent}>
        {/* Title */}
        <div style={styles.titleBlock}>
          {/* Logo */}
          <img src="/img/logo.png" alt="捕梦 Logo" style={styles.logo} />
          <h1 style={styles.title}>
            <span style={styles.titleChar}>捕</span>
            <span style={styles.titleChar}>梦</span>
          </h1>
          <div style={styles.subtitleLine}>
            <span style={styles.subtitleDash}>——</span>
            <span style={styles.subtitle}>体验我想要的故事</span>
          </div>
          <p style={styles.description}>
            AI 驱动的沉浸式叙事平台，创作属于你的剧本，踏入未知的故事世界
          </p>
        </div>

        {/* Two main cards */}
        <div style={styles.cardsRow}>
          {/* 创作平台 */}
          <div
            style={{
              ...styles.card,
              ...(hoveredCard === 'creator' ? styles.cardHover : {}),
            }}
            onMouseEnter={() => setHoveredCard('creator')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleNavigate('creator')}
          >
            <div style={styles.cardIconWrap}>
              <EditOutlined style={styles.cardIcon} />
            </div>
            <h2 style={styles.cardTitle}>创作平台</h2>
            <p style={styles.cardDesc}>
              构建世界观，设计人物关系，编排剧情走向<br />
              用 AI 辅助你的创作，打造独一无二的剧本
            </p>
            <Button
              type="primary"
              size="large"
              style={styles.cardBtn}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredCard('creator');
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                setHoveredCard(null);
              }}
            >
              开始创作
            </Button>
          </div>

          {/* 游戏平台 */}
          <div
            style={{
              ...styles.card,
              ...(hoveredCard === 'game' ? styles.cardHover : {}),
            }}
            onMouseEnter={() => setHoveredCard('game')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleNavigate('game')}
          >
            <div style={styles.cardIconWrap}>
              <PlayCircleOutlined style={styles.cardIcon} />
            </div>
            <h2 style={styles.cardTitle}>游戏平台</h2>
            <p style={styles.cardDesc}>
              选择剧本，扮演角色，沉浸于悬疑故事<br />
              与 AI 主持人互动，体验真人般跑团乐趣
            </p>
            <Button
              type="primary"
              size="large"
              style={styles.cardBtn}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredCard('game');
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                setHoveredCard(null);
              }}
            >
              进入游戏
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          捕梦 BUMENG © 2026 · AI 沉浸式叙事体验平台
        </Text>
      </div>
    </div>
  );
};

// ==================== Styles ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    width: '100vw',
    background: 'linear-gradient(135deg, #0a0015 0%, #140830 30%, #1a1040 60%, #0d1a2d 100%)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  },

  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: `
      radial-gradient(ellipse 80% 50% at 20% 50%, rgba(138, 43, 226, 0.06), transparent 50%),
      radial-gradient(ellipse 60% 40% at 80% 50%, rgba(64, 169, 255, 0.05), transparent 50%),
      radial-gradient(circle at 15% 85%, rgba(255, 140, 200, 0.04), transparent 30%),
      radial-gradient(circle at 85% 15%, rgba(100, 220, 200, 0.04), transparent 30%)
    `,
    pointerEvents: 'none',
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '16px 32px',
    zIndex: 10,
  },

  loginBtn: {
    color: '#c0b0f0',
    fontSize: 14,
    borderColor: 'rgba(192,176,240,0.3)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(8px)',
  },

  userBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#e0d8ff',
    fontSize: 14,
    padding: '4px 12px 4px 4px',
    borderRadius: 24,
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(192,176,240,0.15)',
  },

  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 56,
    padding: '40px 24px',
    zIndex: 2,
  },

  titleBlock: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },

  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 24px rgba(138, 43, 226, 0.4))',
    userSelect: 'none',
  },

  brandTag: {
    fontSize: 11,
    letterSpacing: 6,
    color: 'rgba(255,255,255,0.18)',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },

  title: {
    fontSize: 88,
    fontWeight: 900,
    letterSpacing: 24,
    margin: 0,
    lineHeight: 1.1,
    background: 'linear-gradient(180deg, #e8d5ff 0%, #b38fff 40%, #7c5cfc 70%, #5b3fd4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textShadow: 'none',
    filter: 'drop-shadow(0 0 40px rgba(138, 43, 226, 0.35))',
    userSelect: 'none',
  },

  titleChar: {
    display: 'inline-block',
  },

  subtitleLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },

  subtitleDash: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 18,
    letterSpacing: 4,
  },

  subtitle: {
    fontSize: 22,
    fontWeight: 300,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 6,
  },

  description: {
    marginTop: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    maxWidth: 500,
  },

  cardsRow: {
    display: 'flex',
    gap: 40,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },

  card: {
    width: 320,
    padding: '40px 32px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: 16,
    cursor: 'pointer',
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
  },

  cardHover: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(180,150,255,0.25)',
    transform: 'translateY(-4px)',
    boxShadow: '0 16px 48px rgba(100, 50, 200, 0.15), 0 0 0 1px rgba(180,150,255,0.1) inset',
  },

  cardIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(64, 169, 255, 0.1))',
    border: '1px solid rgba(180,150,255,0.12)',
  },

  cardIcon: {
    fontSize: 32,
    color: '#b38fff',
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#e8d5ff',
    margin: 0,
    letterSpacing: 4,
  },

  cardDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.8,
    letterSpacing: 1,
    margin: 0,
  },

  cardBtn: {
    marginTop: 8,
    height: 44,
    width: 160,
    borderRadius: 22,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 2,
    background: 'linear-gradient(135deg, #7c5cfc, #5b3fd4)',
    border: 'none',
    boxShadow: '0 4px 16px rgba(124, 92, 252, 0.3)',
  },

  footer: {
    padding: '20px 0',
    zIndex: 2,
  },
};

export default HomePage;
