import React from 'react';
import GraphCanvas from '../components/GraphCanvas/GraphCanvas';
import DetailPanel from '../components/DetailPanel/DetailPanel';

const PlotPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      <div style={{ flex: '0 0 65%', borderRight: '1px solid #f0f0f0' }}>
        <GraphCanvas pageType="plot" />
      </div>
      <div style={{ flex: '0 0 35%', overflow: 'auto' }}>
        <DetailPanel pageType="plot" />
      </div>
    </div>
  );
};

export default PlotPage;
