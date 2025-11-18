import { useEffect } from 'react';
import { initBoardRenderer } from './canvas/BoardRenderer';

function BoardRenderer() {
  useEffect(() => {
    initBoardRenderer('board-container');
  }, []);

  return <div id="board-container" style={{ position: 'relative' }} />;
}

export default BoardRenderer;








