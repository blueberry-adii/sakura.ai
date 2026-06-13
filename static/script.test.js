const assert = require('assert');
const { generateResponseText, escapeHTML, formatTimeAgo, getGreetingMessage, groupChatsByDate } = require('./script.js');

console.log('--- Starting Aries script.js Unit Tests ---');

// Test 1: HTML Escaping
try {
  console.log('Running Test 1: escapeHTML...');
  const input = '<div>Hello & "World"</div>';
  const expected = '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;';
  const actual = escapeHTML(input);
  assert.strictEqual(actual, expected);
  console.log('✓ HTML escaping matches expected pattern.');
} catch (err) {
  console.error('✗ HTML escaping test failed:', err.message);
  process.exit(1);
}

// Test 2: Bot Response Keywords Mapping
try {
  console.log('Running Test 2: generateResponseText...');
  const greetings = ['hello', 'hi', 'greetings'];
  greetings.forEach(word => {
    const res = generateResponseText(word);
    assert.ok(res.length > 0, `Response for ${word} is too short`);
  });
  
  const coding = ['write a python function', 'javascript code', 'program details'];
  coding.forEach(word => {
    const res = generateResponseText(word);
    assert.ok(res.includes('code') || res.includes('implement') || res.includes('write'), `Coding match failed for: ${word}`);
  });

  const fallback = generateResponseText('random prompt string');
  assert.ok(fallback.length > 0);
  console.log('✓ Bot response generation resolves keywords correctly.');
} catch (err) {
  console.error('✗ Bot response test failed:', err.message);
  process.exit(1);
}

// Test 3: Relative Time Formatter
try {
  console.log('Running Test 3: formatTimeAgo...');
  const now = new Date();
  
  // Just now
  const justNow = formatTimeAgo(now.toISOString());
  assert.strictEqual(justNow, 'Just now');
  
  // Minutes ago
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const tenMinsStr = formatTimeAgo(tenMinsAgo.toISOString());
  assert.strictEqual(tenMinsStr, '10m ago');

  // Hours ago
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const threeHoursStr = formatTimeAgo(threeHoursAgo.toISOString());
  assert.strictEqual(threeHoursStr, '3h ago');
  
  console.log('✓ Relative time formatter works correctly.');
} catch (err) {
  console.error('✗ Relative time formatter test failed:', err.message);
  process.exit(1);
}

// Test 4: Dynamic Hourly Greetings
try {
  console.log('Running Test 4: getGreetingMessage...');
  assert.strictEqual(getGreetingMessage(8), 'Good Morning! Aries at your service.');
  assert.strictEqual(getGreetingMessage(14), 'Good Afternoon! Aries at your service.');
  assert.strictEqual(getGreetingMessage(19), 'Good Evening! Aries at your service.');
  assert.strictEqual(getGreetingMessage(23), 'Aries at your service. What are we building tonight?');
  console.log('✓ Dynamic greetings map hours correctly.');
} catch (err) {
  console.error('✗ Dynamic greetings test failed:', err.message);
  process.exit(1);
}

// Test 5: Dynamic Date Grouping
try {
  console.log('Running Test 5: groupChatsByDate...');
  const now = new Date();
  
  const todayISO = now.toISOString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yesterdayISO = yesterday.toISOString();
  
  const olderDate = new Date('2026-06-11T12:00:00Z');
  const olderISO = olderDate.toISOString();

  const mockChats = [
    { id: '1', title: 'Chat 1', timestamp: todayISO },
    { id: '2', title: 'Chat 2', timestamp: yesterdayISO },
    { id: '3', title: 'Chat 3', timestamp: olderISO }
  ];

  const grouped = groupChatsByDate(mockChats);
  
  assert.ok(grouped['Today']);
  assert.strictEqual(grouped['Today'][0].title, 'Chat 1');
  
  assert.ok(grouped['Yesterday']);
  assert.strictEqual(grouped['Yesterday'][0].title, 'Chat 2');
  
  assert.ok(grouped['June 11, 2026'] || grouped['11 June 2026']);
  const olderKey = grouped['June 11, 2026'] ? 'June 11, 2026' : '11 June 2026';
  assert.strictEqual(grouped[olderKey][0].title, 'Chat 3');

  console.log('✓ Date grouping resolves Today, Yesterday, and legacy calendar structures.');
} catch (err) {
  console.error('✗ Date grouping test failed:', err.message);
  process.exit(1);
}

console.log('--- All Aries script.js Unit Tests Passed! ---');
process.exit(0);
