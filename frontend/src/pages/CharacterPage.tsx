import React from 'react';
import GraphCanvas from '../components/GraphCanvas/GraphCanvas';
import DetailPanel from '../components/DetailPanel/DetailPanel';

const CharacterPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      <div style={{ flex: '0 0 65%', borderRight: '1px solid #f0f0f0' }}>
        <GraphCanvas pageType="character" />
      </div>
      <div style={{ flex: '0 0 35%', overflow: 'auto' }}>
        <DetailPanel pageType="character" />
      </div>
    </div>
  );
};

export default CharacterPage;
