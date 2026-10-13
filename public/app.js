const flowData = {
  nodes: [
    { id: 'auth', label: 'Authenticated User', x: 28, y: 20, width: 160, height: 52, className: 'root' },
    { id: 'budgets', label: 'Manage Budgets', x: 70, y: 145, width: 180, height: 46, className: 'primary' },
    { id: 'categories', label: 'Manage Categories', x: 320, y: 145, width: 180, height: 46, className: 'primary' },
    { id: 'accounts', label: 'Manage Accounts', x: 570, y: 145, width: 180, height: 46, className: 'primary' },
    { id: 'transactions', label: 'Manage Transactions', x: 820, y: 145, width: 198, height: 46, className: 'primary' },
    { id: 'dashboard', label: 'View Dashboard', x: 1120, y: 145, width: 180, height: 46, className: 'primary' },
    { id: 'reports', label: 'View Reports', x: 1360, y: 145, width: 180, height: 46, className: 'primary' },
    { id: 'debts', label: 'Manage Debts & Loans', x: 1610, y: 145, width: 200, height: 46, className: 'primary' },

    { id: 'budget-usage', label: 'Calculate Budget Usage', x: 70, y: 350, width: 180, height: 48, className: 'secondary' },
    { id: 'balance', label: 'Apply Balance Change', x: 310, y: 350, width: 180, height: 48, className: 'secondary' },
    { id: 'search-transactions', label: 'Search & Filter Transactions', x: 550, y: 350, width: 184, height: 48, className: 'secondary' },
    { id: 'validate', label: 'Validate Transaction', x: 795, y: 350, width: 180, height: 48, className: 'secondary' },
    { id: 'notifications', label: 'Manage Notifications', x: 1020, y: 350, width: 180, height: 48, className: 'secondary' },
    { id: 'retrieve', label: 'Retrieve Recent Transactions', x: 1250, y: 350, width: 190, height: 48, className: 'secondary' },
    { id: 'chart', label: 'Chart Data', x: 1500, y: 350, width: 160, height: 48, className: 'secondary' },
    { id: 'summary', label: 'Calculate Financial Summary', x: 1720, y: 350, width: 200, height: 48, className: 'secondary' },

    { id: 'warn-budget', label: 'Budget Warnings', x: 630, y: 530, width: 188, height: 46, className: 'warning' },
    { id: 'warn-debt', label: 'Debt Due Warnings', x: 1110, y: 530, width: 176, height: 46, className: 'warning' },
    { id: 'report', label: 'Export Report', x: 1490, y: 530, width: 160, height: 46, className: 'warning' },

    { id: 'when-budge', label: 'when necessary', x: 1015, y: 267, type: 'tag', className: 'label-tag' },
    { id: 'when-debt', label: 'when necessary', x: 1475, y: 267, type: 'tag', className: 'label-tag' },
    { id: 'when-requested', label: 'when requested', x: 1850, y: 267, type: 'tag', className: 'label-tag' }
  ],
  connections: [
    { d: 'M 108 72 L 108 116 L 160 116 L 160 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 410 116 L 410 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 660 116 L 660 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 920 116 L 920 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 1220 116 L 1220 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 1450 116 L 1450 145', kind: 'solid' },
    { d: 'M 108 72 L 108 116 L 1710 116 L 1710 145', kind: 'solid' },

    { d: 'M 160 191 L 160 270 L 160 270 L 160 350', kind: 'solid' },
    { d: 'M 410 191 L 410 270 L 400 270 L 400 350', kind: 'solid' },
    { d: 'M 660 191 L 660 270 L 640 270 L 640 350', kind: 'solid' },
    { d: 'M 920 191 L 920 270 L 885 270 L 885 350', kind: 'solid' },
    { d: 'M 1220 191 L 1220 270 L 1115 270 L 1115 350', kind: 'solid' },
    { d: 'M 1450 191 L 1450 270 L 1345 270 L 1345 350', kind: 'solid' },
    { d: 'M 1710 191 L 1710 270 L 1580 270 L 1580 350', kind: 'solid' },
    { d: 'M 1710 191 L 1710 270 L 1820 270 L 1820 350', kind: 'solid' },

    { d: 'M 160 398 L 160 470 L 730 470 L 730 530', kind: 'solid' },
    { d: 'M 1115 398 L 1115 470 L 1210 470 L 1210 530', kind: 'solid' },
    { d: 'M 1580 398 L 1580 470 L 1570 470 L 1570 530', kind: 'solid' },

    { d: 'M 1115 191 L 1115 250 L 1115 250 L 1115 350', kind: 'soft' },
    { d: 'M 1450 191 L 1450 250 L 1450 250 L 1450 350', kind: 'soft' },
    { d: 'M 1710 191 L 1710 250 L 1710 250 L 1710 350', kind: 'soft' }
  ]
};

function createNode(node) {
  const el = document.createElement('div');
  el.className = `node ${node.className || ''}`;
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${node.width || 180}px`;
  el.style.height = `${node.height || 46}px`;
  el.textContent = node.label;
  return el;
}

function createConnections() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'flow-svg');
  svg.setAttribute('viewBox', '0 0 1950 720');

  flowData.connections.forEach((connection) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', connection.d);
    path.setAttribute('class', connection.kind === 'soft' ? 'connector-soft' : 'connector');
    svg.appendChild(path);
  });

  return svg;
}

function init() {
  const diagram = document.getElementById('diagram');
  const svg = createConnections();
  diagram.appendChild(svg);

  flowData.nodes.forEach((node) => {
    if (node.type === 'tag') {
      const label = document.createElement('div');
      label.className = `node label-tag ${node.className || ''}`;
      label.style.left = `${node.x}px`;
      label.style.top = `${node.y}px`;
      label.textContent = node.label;
      label.style.width = 'auto';
      label.style.height = 'auto';
      label.style.padding = '0';
      label.style.background = 'transparent';
      label.style.border = 'none';
      label.style.boxShadow = 'none';
      diagram.appendChild(label);
      return;
    }

    diagram.appendChild(createNode(node));
  });
}

init();
