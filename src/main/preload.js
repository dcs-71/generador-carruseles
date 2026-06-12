const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('academyAPI', {
  getInitialData: () => invoke('app:initialData'),
  importCsv: () => invoke('ideas:importCsv'),
  saveSettings: (settings) => invoke('settings:save', settings),
  startBatch: (payload) => invoke('generation:startBatch', payload),
  cancelGeneration: () => invoke('generation:cancel'),
  regenerateSlide: (payload) => invoke('generation:regenerateSlide', payload),
  regenerateCarousel: (payload) => invoke('generation:regenerateCarousel', payload),
  deleteCarousel: (payload) => invoke('carousel:delete', payload),
  updateCarouselStatus: (payload) => invoke('carousel:updateStatus', payload),
  exportApprovedBatch: () => invoke('export:approvedBatch'),
  exportCarousel: (payload) => invoke('export:carousel', payload),
  openPath: (targetPath) => invoke('shell:openPath', targetPath),
  onGenerationProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('generation:progress', listener);
    return () => ipcRenderer.removeListener('generation:progress', listener);
  }
});
