// Token Radar dashboard entry script. Reads window.RADAR and renders the interactive board, tabs, filtering, detail dialog, and farm execution steps.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var root = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var currencyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function formatUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return currencyFormat.format(n);
  }

  function formatPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function formatAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function computeImplied(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.category_ratio * row.momentum_factor * row.age_factor));
  }

  function createElement(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'html') node.innerHTML = attrs[key];
        else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), attrs[key]);
        else if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, attrs[key]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function getChain(p) {
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }

  function getCapital(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }

  function getHoldDays(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function getAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) {
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) {
      return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    }
    if (c.indexOf('bridge') >= 0) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    }
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) {
      return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) {
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    }
    if (c.indexOf('prediction') >= 0) {
      return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) {
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    }
    if (c.indexOf('stable') >= 0) {
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    }
    if (c.indexOf('rwa') >= 0) {
      return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    }
    if (c.indexOf('insurance') >= 0) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    }
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  function formatStepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }

  function generateFallbackSteps(p) {
    var chain = getChain(p);
    var capital = getCapital(p);
    var hold = getHoldDays(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: getAction(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(formatStepText);
  }

  function readUrlHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    if (hash === 'model') {
      setTimeout(function () {
        var el = document.getElementById('model');
        if (el) el.scrollIntoView();
      }, 0);
    }
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }

  function writeUrlHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var nextQuery = params.toString();
    if (nextQuery) {
      window.history.replaceState(null, '', '#' + nextQuery);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function filterRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var queryTarget = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return queryTarget.indexOf(q) >= 0;
    });
  }

  function sortRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (key === 'tvl') {
        av = a.tvl_usd;
        bv = b.tvl_usd;
      } else if (key === 'growth') {
        av = a.change_7d === null ? -Infinity : a.change_7d;
        bv = b.change_7d === null ? -Infinity : b.change_7d;
      } else if (key === 'age') {
        av = a.age_days === null ? Infinity : a.age_days;
        bv = b.age_days === null ? Infinity : b.age_days;
      } else {
        av = a.implied_value_usd;
        bv = b.implied_value_usd;
      }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function buildHeader() {
    return createElement('header', { class: 'top' },
      createElement('div', { class: 'brand' },
        createElement('span', { class: 'mark' }),
        createElement('span', { class: 'brand-name', text: 'LaunchScope' })
      ),
      createElement('div', { class: 'top-meta' },
        createElement('span', { text: 'Snapshot ' + DATA.as_of }),
        createElement('span', { text: 'DefiLlama protocol index' }),
        createElement('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function buildLede() {
    var floorMillion = Math.round(DATA.floor_usd / 1e6);
    return createElement('section', { class: 'lede' },
      createElement('div', null,
        createElement('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        createElement('p', { text: 'The watchlist is the floor: every protocol with at least $' + floorMillion + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise.' }),
        createElement('p', { class: 'sub', text: 'Integrity: ' + DATA.board_size + ' rows ranked — every launch candidate in the snapshot. ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' watchlist protocols covered, sorted by implied value. ' + DATA.excluded_count + ' bridges and wrapped/staked products set aside (they move or wrap an asset that already trades). Model fit: within 2x of actual market cap for ' + DATA.fit.within_2x_pct + '% of ' + DATA.fit.test_n + ' held-out peers in a split-half test and ' + DATA.fit.test_b_within_2x_pct + '% of ' + DATA.fit.test_b_n + ' in a leave-one-category-out test.' })
      ),
      createElement('div', { class: 'facts' },
        createElement('div', { class: 'fact' }, createElement('span', { text: 'Watchlist covered' }), createElement('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        createElement('div', { class: 'fact' }, createElement('span', { text: 'Pre-token rows scored' }), createElement('b', { text: String(DATA.board_size) })),
        createElement('div', { class: 'fact' }, createElement('span', { text: 'Early rows below the floor' }), createElement('b', { text: String(DATA.early_size) })),
        createElement('div', { class: 'fact' }, createElement('span', { text: 'Live-token protocols set aside' }), createElement('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function buildControls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var searchInput = createElement('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      writeUrlHash();
      renderApp();
    });

    var categorySelect = createElement('select', { id: 'category', 'aria-label': 'Filter by category' },
      createElement('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) {
        return createElement('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })
    );
    categorySelect.addEventListener('change', function () {
      state.category = categorySelect.value;
      writeUrlHash();
      renderApp();
    });

    var preTokenBtn = createElement('button', {
      type: 'button',
      'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false',
      text: 'Pre-token',
      onclick: function () { state.tab = 'pre-token'; renderApp(); }
    });

    var liveTokenBtn = createElement('button', {
      type: 'button',
      'aria-pressed': state.tab === 'live' ? 'true' : 'false',
      text: 'Live token',
      onclick: function () { state.tab = 'live'; renderApp(); }
    });

    var countText = state.tab === 'pre-token' ? filterRows().length + ' rows shown' : DATA.live.length + ' live-token protocols';

    return createElement('div', { class: 'controls' },
      createElement('div', { class: 'field' }, createElement('label', { for: 'q', text: 'Search' }), searchInput),
      createElement('div', { class: 'field' }, createElement('label', { for: 'category', text: 'Category' }), categorySelect),
      createElement('div', { class: 'field' }, createElement('span', { class: 'sub', text: 'Token status' }), createElement('div', { class: 'tabs' }, preTokenBtn, liveTokenBtn)),
      createElement('span', { class: 'count', text: countText })
    );
  }

  function buildSortHeader(key, label) {
    return createElement('th', { scope: 'col' },
      createElement('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = -1; }
          renderApp();
        }
      },
        label,
        state.sort === key ? createElement('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function buildBoardTable() {
    var list = sortRows(filterRows());
    if (list.length === 0) {
      return createElement('div', { class: 'panel' },
        createElement('div', { class: 'empty' },
          createElement('h2', { text: 'No protocol matches that filter' }),
          createElement('p', { text: 'Clear the search or pick another category to see the board again.' }),
          createElement('button', {
            class: 'button primary',
            type: 'button',
            text: 'Clear filters',
            onclick: function () {
              state.q = '';
              state.category = 'all';
              writeUrlHash();
              renderApp();
            }
          })
        )
      );
    }

    var maxImplied = list[0].implied_value_usd || 1;
    var tbody = createElement('tbody');

    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : formatPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var chainsSubline = (r.chains && r.chains.length > 0) ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var categoryName = r.category || 'Other';

      var tr = createElement('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetailDialog(r.slug); },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetailDialog(r.slug);
          }
        }
      },
        createElement('td', { class: 'num', text: String(r.rank) }),
        createElement('td', null,
          createElement('div', { class: 'name' },
            createElement('b', { text: r.name }),
            createElement('span', { class: 'sub', text: categoryName + ' on ' + chainsSubline })
          )
        ),
        createElement('td', { class: 'num', text: formatUsd(r.tvl_usd) }),
        createElement('td', { class: 'num ' + growthClass, text: growth }),
        createElement('td', { class: 'num', text: formatAge(r.age_days) }),
        createElement('td', null,
          createElement('div', { class: 'implied' },
            createElement('div', { class: 'bar', 'aria-hidden': 'true' },
              createElement('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / maxImplied) * 100)) + '%' })
            ),
            createElement('span', { class: 'num', text: formatUsd(r.implied_value_usd) })
          )
        ),
        createElement('td', null, createElement('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });

    return createElement('div', { class: 'panel' },
      createElement('div', { class: 'table-wrap' },
        createElement('table', null,
          createElement('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          createElement('thead', null,
            createElement('tr', null,
              buildSortHeader('implied', 'Rank'),
              buildSortHeader('name', 'Protocol'),
              buildSortHeader('tvl', 'TVL'),
              buildSortHeader('growth', '7d'),
              buildSortHeader('age', 'Age'),
              buildSortHeader('implied', 'Implied value'),
              createElement('th', { scope: 'col', text: 'Token' })
            )
          ),
          tbody
        )
      )
    );
  }

  function buildLiveTable() {
    var tbody = createElement('tbody');
    DATA.live.forEach(function (r) {
      var chainsSubline = (r.chains && r.chains.length > 0) ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var categoryName = r.category || 'Other';
      var growth = r.change_7d === null ? 'n/a' : formatPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';

      tbody.appendChild(
        createElement('tr', null,
          createElement('td', { class: 'num', text: 'live' }),
          createElement('td', null,
            createElement('div', { class: 'name' },
              createElement('b', { text: r.name }),
              createElement('span', { class: 'sub', text: categoryName + ' on ' + chainsSubline })
            )
          ),
          createElement('td', { class: 'num', text: formatUsd(r.tvl_usd) }),
          createElement('td', { class: 'num ' + growthClass, text: growth }),
          createElement('td', { class: 'num', text: formatUsd(r.mcap_usd) }),
          createElement('td', null, createElement('span', { class: 'status', text: 'already trades' }))
        )
      );
    });

    return createElement('div', { class: 'panel' },
      createElement('div', { class: 'table-wrap' },
        createElement('table', null,
          createElement('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          createElement('thead', null,
            createElement('tr', null,
              createElement('th', { scope: 'col', text: 'Status' }),
              createElement('th', { scope: 'col', text: 'Protocol' }),
              createElement('th', { scope: 'col', text: 'TVL' }),
              createElement('th', { scope: 'col', text: '7d' }),
              createElement('th', { scope: 'col', text: 'Market cap' }),
              createElement('th', { scope: 'col', text: 'Token' })
            )
          ),
          tbody
        )
      )
    );
  }

  function buildModelPanel() {
    var m = DATA.model;
    var f = DATA.fit || {};
    return createElement('section', { class: 'panel model', id: 'model' },
      createElement('h2', { text: 'How implied value is computed' }),
      createElement('p', { class: 'sub', text: 'Every row is scored by a valuation model fitted on this snapshot\'s own tokenized peers, then scaled by momentum, age, and the category\'s token-launch record.' }),
      createElement('div', { class: 'formula' }, 'implied = round( tvl_usd x category_ratio x momentum_factor(change_7d) x age_factor(age_days) )'),
      createElement('p', { class: 'sub', text: 'Fitted on ' + (f.peers_tokenized !== undefined ? f.peers_tokenized : '') + ' tokenized peers: ln(market cap) = ' + (f.intercept !== undefined ? f.intercept : '') + ' + ' + (f.slope !== undefined ? f.slope : '') + ' x ln(TVL), with a per-category intercept from peer residuals. Held out on a deterministic half of the peers, the fit lands within 2x of the actual market cap for ' + (f.within_2x_pct !== undefined ? f.within_2x_pct : '') + '% of ' + (f.test_n !== undefined ? f.test_n : '') + ' test peers (median error ' + (f.median_abs_err_pct !== undefined ? f.median_abs_err_pct : '') + '%). Each category\'s multiple is then adjusted by its launch record: across the snapshot ' + (f.global_launch_rate_pct !== undefined ? f.global_launch_rate_pct : '') + '% of protocols already have a token. Bridges, canonical bridges and wrapped/staked products are excluded from the board and from the fit. The fit is validated on two blind tests — a split-half test and a leave-one-category-out test — and each multiple is then adjusted by its category launch record.' }),
      createElement('p', { class: 'sub', text: 'Category anchor ratios use the median mcap/tvl ratio of tokenized peers in each category (global median ' + m.global_median_ratio + ' for categories with <3 peers). Momentum clamps change_7d to [' + m.momentum_floor + ', ' + m.momentum_cap + '], and age scales the tokenless track record up to ' + m.age_cap + '.' }),
      createElement('table', { class: 'peers' },
        createElement('caption', { text: 'Fitted peers — the largest tokenized protocols the model was fitted on' }),
        createElement('thead', null,
          createElement('tr', null,
            createElement('th', { text: 'Protocol' }),
            createElement('th', { text: 'TVL' }),
            createElement('th', { text: 'Actual market cap' }),
            createElement('th', { text: 'Fitted value' }),
            createElement('th', { text: 'Actual / fitted' })
          )
        ),
        createElement('tbody', null,
          (DATA.fitted_peers || []).map(function (p) {
            return createElement('tr', null,
              createElement('td', { text: p.name }),
              createElement('td', { class: 'num', text: formatUsd(p.tvl_usd) }),
              createElement('td', { class: 'num', text: formatUsd(p.mcap_usd) }),
              createElement('td', { class: 'num', text: formatUsd(p.fitted_usd) }),
              createElement('td', { class: 'num', text: String(p.ratio) })
            );
          })
        )
      )
    );
  }

  var detailDialog = createElement('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  detailDialog.addEventListener('close', function () {
    state.selected = null;
    writeUrlHash();
  });

  function openDetailDialog(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeUrlHash();
    detailDialog.textContent = '';

    var steps = row.farm_steps || generateFallbackSteps(row);
    var computed = computeImplied(row);
    var matches = Math.abs(computed - row.implied_value_usd) / (row.implied_value_usd || 1) <= 0.01;
    var chainsText = (row.chains && row.chains.length > 0) ? row.chains.join(', ') : 'an unnamed chain';
    var categoryName = row.category || 'Other';

    detailDialog.appendChild(
      createElement('div', { class: 'detail-head' },
        createElement('div', null,
          createElement('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
          createElement('h2', { id: 'detail-title', text: row.name }),
          createElement('p', { class: 'sub', text: categoryName + ' on ' + chainsText })
        ),
        createElement('button', {
          class: 'close',
          type: 'button',
          'aria-label': 'Close details',
          text: 'Close',
          onclick: function () { detailDialog.close(); }
        })
      )
    );

    detailDialog.appendChild(
      createElement('section', { class: 'detail-section' },
        createElement('h3', { text: 'Implied value' }),
        createElement('div', { class: 'equation' },
          createElement('div', null, createElement('span', { text: 'TVL' }), createElement('b', { class: 'num', text: formatUsd(row.tvl_usd) })),
          createElement('div', null, createElement('span', { text: 'Seven-day growth' }), createElement('b', { class: 'num', text: formatPct(row.change_7d) })),
          createElement('div', null, createElement('span', { text: 'Age with no token' }), createElement('b', { class: 'num', text: formatAge(row.age_days) })),
          createElement('div', null, createElement('span', { text: 'Fitted multiple' }), createElement('b', { class: 'num', text: String(row.category_ratio) })),
          createElement('div', null, createElement('span', { text: 'Momentum factor' }), createElement('b', { class: 'num', text: String(row.momentum_factor) })),
          createElement('div', null, createElement('span', { text: 'Age factor' }), createElement('b', { class: 'num', text: String(row.age_factor) })),
          createElement('div', null, createElement('span', { text: 'Category launch record' }), createElement('b', { class: 'num', text: row.peer_rate + '% have tokens (' + row.peer_tokenized + ' peers)' })),
          createElement('div', null, createElement('span', { text: 'Launch odds' }), createElement('b', { class: 'num', text: row.launch_odds_pct + '%' })),
          createElement('div', null, createElement('span', { text: 'Implied value' }), createElement('b', { class: 'num', text: formatUsd(row.implied_value_usd) }))
          ),
          createElement('p', { class: 'sub', text: 'Launch odds fall with age: a protocol that has stayed tokenless longer is less likely to launch soon.' }),
          createElement('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': log-log fit on the snapshot\'s tokenized peers, adjusted by the category launch record. The page recomputes this row as ' + formatUsd(computed) + (matches ? ', the same number board.json carries within the rounding of the published factors.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
      )
    );

    detailDialog.appendChild(
      createElement('section', { class: 'detail-section' },
        createElement('h3', { text: 'Farm plan' }),
        createElement('ol', { class: 'steps' }, steps.map(function (s) {
          var costIndex = s.indexOf(' Cost: ');
          var actionText = costIndex >= 0 ? s.slice(0, costIndex) : s;
          var costTimeText = costIndex >= 0 ? s.slice(costIndex + 1) : '';
          return createElement('li', null,
            createElement('b', { text: actionText }),
            createElement('span', { class: 'cost', text: costTimeText })
          );
        })),
        createElement('p', { class: 'sub', text: 'Farm economics: about $' + row.farm_total_gas_usd + ' of gas and ' + row.farm_total_minutes + ' minutes over ' + row.farm_weeks + ' weeks to farm a protocol the model values at ' + formatUsd(row.implied_value_usd) + ', with launch odds of ' + row.launch_odds_pct + '%.' })
      )
    );

    if (typeof detailDialog.showModal === 'function') {
      if (!detailDialog.open) detailDialog.showModal();
    } else {
      detailDialog.setAttribute('open', '');
    }
  }

  function renderApp() {
    root.textContent = '';
    var shell = createElement('div', { class: 'shell' });
    shell.appendChild(buildHeader());
    shell.appendChild(buildLede());
    shell.appendChild(buildControls());
    shell.appendChild(state.tab === 'pre-token' ? buildBoardTable() : buildLiveTable());
    if (state.tab === 'pre-token') shell.appendChild(buildModelPanel());
    root.appendChild(shell);
    root.setAttribute('aria-busy', 'false');

    if (!detailDialog.isConnected) {
      root.appendChild(detailDialog);
    }
    if (state.selected) {
      openDetailDialog(state.selected);
    }
  }

  readUrlHash();
  renderApp();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && detailDialog.open) {
      detailDialog.close();
    }
  });
})();
