/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    window.location.replace('./site/index.html');
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-[#e7f5f0] text-[#1e3a34] font-bold">
      <p>正在前往 <a href="./site/index.html" className="underline text-[#2a8a74]">彰基糖友島</a>...</p>
    </div>
  );
}
