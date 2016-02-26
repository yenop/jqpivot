# Options #

## data ##

**required**<br>
<b>type</b>: array | object | function | string<br>
<br>
Data to use.<br>
If array of objects - this array will be used as data.<br>
If object - this object should contains array of objects inside. Plugin will try to find first array and use it as data.<br>
If function - this function should return array of object or object with array of objects.<br>
If string - it will be used as URL, plugin will make ajax request and will expext JSON array of objects or JSON object with array of objects.<br>
<br>
<h2>columns</h2>

<b>type</b>: array<br>

Initial column set, by names.<br>
<pre><code>columns: ['name']<br>
</code></pre>

<h2>rows</h2>

<b>type</b>: array<br>

Initial row set, by names.<br>
<pre><code>rows: ['city', 'year']<br>
</code></pre>

<h2>dimensions</h2>

<b>type</b>: object<br>
<br>
Settings for dimensions: type, filter, sort order, sort index. There is no need to set all settings.<br>
<pre><code>dimensions: {<br>
  'id': {<br>
    type: 'number',<br>
    sort: 'desc',<br>
    filter: {<br>
      value: [20,undefined] // means &gt;=20<br>
    }<br>
  },<br>
  'city': {<br>
    type: 'string',<br>
    sortIndex: 1, // this will be firts in all dimensions list<br>
    filter: {<br>
      value: 'rome', // means contains 'rome' substring, case insensitive<br>
      _exact: { // you can set exact values<br>
        'Paris': 1,<br>
        'Berlin': 1<br>
      }<br>
    }<br>
  },<br>
  'date': {<br>
    type: 'date',<br>
    filter: {<br>
      value: [undefined, '21/10/2013'] // means &lt;= '21/10/2013', values will cast to Date<br>
    }<br>
  }  <br>
}<br>
</code></pre>
By default, plugin takes first object from data, get all fields from it and tries to recognize types.<br>
<br>
<h2>facts</h2>

<b>type</b>: array<br>
<br>
Initial data set.<br>
<pre><code>facts: [{<br>
  by: 'price',<br>
  func: 'sum'<br>
}]<br>
</code></pre>

<h2>sorter</h2>

<b>type</b>: function<br>
<br>
Sorter function, can be defined instead of (or with) dimensions 'sortIndex'.<br>
<br>
<h2>defaultFunc</h2>

<b>type</b>: string<br>
<b>default</b>: 'count'<br>
<br>
The name of default aggregation function.<br>
<br>
<h2>showZeros</h2>

<b>type</b>: boolean<br>
<b>default</b>: false<br>
<br>
Show zeros inside table or not.<br>
<br>
<h2>listeners</h2>

<b>type</b>: object with functions<br>

Event listeners, may be following:<br>
<br>
<ul><li><b>start</b>: function() { ... }<br>before pivot table calculating started</li></ul>

<ul><li><b>hidedetails</b>: function() { ... }<br>after hide details table</li></ul>

<ul><li><b>showdetails</b>: function($detailstable) { ... }<br>after show details table</li></ul>

<ul><li><b>ready</b>: function($pivottable) { ... }<br>after pivot table is calculated</li></ul>

Inside listeners <b>this</b> statement points to jQuery object, where plugin is initialized.