const simulateIssueBtn = document.getElementById('simulateIssueBtn');
const statusNode = document.getElementById('status');

const setStatus = (text, color) => {
  statusNode.textContent = text;
  statusNode.style.color = color;
};

simulateIssueBtn.addEventListener('click', async () => {
  setStatus('Generating simulated issue...', '#0f172a');

  try {
    const response = await fetch('/api/simulate-issue', { method: 'POST' });
    const payload = await response.json();

    if (!response.ok) {
      if (payload.errorId) {
        setStatus(`Issue generated (${payload.errorId}). Check logs.`, '#b91c1c');
        return;
      }

      setStatus(payload.message || 'Simulation endpoint is unavailable.', '#b91c1c');
      return;
    }

    setStatus('No issue generated.', '#16a34a');
  } catch (_error) {
    setStatus('Failed to call API. Is the server running?', '#b91c1c');
  }
});
