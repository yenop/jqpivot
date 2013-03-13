/*
 * Pivot Table - jQuery Plugin
 * jQuery pivot table plugin
 *
 * Source and documentation at: http://code.google.com/p/jqpivot/
 * Demo: http://yumaa.name/jqpivot/
 *
 * Version 0.9a
 * Require jquery (tested on 1.8.3)
 * Require jqueryui (tested on 1.10.0)
 *            - sortable
 *            - draggable
 *            - droppable
 *            - datepicker
 * Desirable stickytableheaders jquery plugin ( https://github.com/jmosbech/StickyTableHeaders )
 *
 * Author Didenko Victor
 *
 * Released under the MIT license
 *
 * Copyright (C) 2013 Didenko Victor
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

;(function ($, window, undefined) {
	'use strict';

	$.extend({
		jqpivot: new
		function() {

			// default settings, can be overwritten
			this.defaults = {
				data: undefined, // url string to json data file, or array with data, or function which returns data array
				listeners: {
				//	start: function() {},
				//	hidedetails: function() {},
				// 	showdetails: function($detailstable) {},
				// 	ready: function($pivottable) {},
				},
				// dimensions
				//	e.g. {
				//		'asd': {
				//			type: 'number',
				//			sort: 'desc',
				//			filter: {
				//				value: [20,undefined]
				//			}
				//		},
				//		'qwe': {
				//			type: 'string',
				//			filter: {
				//				value: 'test'
				//			}
				//		}
				//	}
				// columns // e.g. ['qwe']
				// rows // e.g. ['asd']
				// facts // e.g. [{ by: 'zxc', func: 'sum' }]
				// sorter // dimension sort function
				defaultFunc: 'count', // default aggregation function
				showZeros: false // show 0,null,undefined,'' values in table or not
			};

			// default functions, can be overwritten or extended
			// called with arguments:
			// @param array of objects to calculate aggregation
			// @param aggregation field name
			// 'this' pointed to jquery jqpivot object
			this.functions = {
				'count': function(arr, by) {
					if (arguments.length === 0)
						return 'count of all values';

					return arr.length;
				},
				'uniqcount': function(arr, by) {
					if (arguments.length === 0)
						return 'count of all unique values';

					var ret = 0,
					    val, i,
					    orr = {};
					for (i = arr.length; i--;) {
						val = '' + arr[i][by];
						if (!orr.hasOwnProperty(val)) {
							ret++;
							orr[val] = 1;
						}
					}
					return ret;
				},
				'sum': function(arr, by) {
					if (arguments.length === 0)
						return 'sum of all values';

					var ret = 0, i;
					for (i = arr.length; i--;)
						ret += +arr[i][by];
					return ret;
				},
				'uniqsum': function(arr, by) {
					if (arguments.length === 0)
						return 'sum of all unique values';

					var ret = 0,
					    val, i,
					    orr = {};
					for (i = arr.length; i--;) {
						val = '' + arr[i][by];
						if (!orr.hasOwnProperty(val)) {
							ret += +arr[i][by];
							orr[val] = 1;
						}
					}
					return ret;
				}/*,
				'min': function(arr, by) {
					if (arguments.length === 0)
						return 'minimal value';

					var ret, i;
					for (i = arr.length; i--;)
						if (ret === undefined || arr[i][by] < ret)
							ret = arr[i][by];
					return ret === undefined ? ret : +ret;
				},
				'max': function(arr, by) {
					if (arguments.length === 0)
						return 'maximal value';

					var ret, i;
					for (i = arr.length; i--;)
						if (ret === undefined || arr[i][by] > ret)
							ret = arr[i][by];
					return ret === undefined ? ret : +ret;
				}/**/
				// average
				// standard deviation
			};

			// *** private functions ***

			function rise(me, ev) {
				var jqpivot = me.data('jqpivot');
				if (!$.isEmptyObject(jqpivot.config.listeners)) {
					if (jqpivot.config.listeners.hasOwnProperty(ev) && $.isFunction(jqpivot.config.listeners[ev])) {
						var args = Array.prototype.slice.call(arguments, 2);
						window.setTimeout(function() {
							jqpivot.config.listeners[ev].apply(me, args);
						}, 1);
					}
				}
			}

			/**
			 * load data
			 * @param data, can be
			 *   - javascript array with data
			 *   - javascript object with array inside
			 *   - function, which returns array or object with data
			 *   - url to json-stored data
			 * @param callback, function which called when data is received
			 */
			function initData(data, callback) {
				// if 'data' is array or undefined -> just return it
				if ($.isArray(data) || data === undefined)
					return callback(data);

				// if 'data' is object -> try to find array inside object
				if ($.isPlainObject(data)) {
					for (var key in data)
						if ($.isArray(data[key]))
							return callback(data[key]);
					return callback(undefined);
				}

				// if 'data' is function -> execute function and return function result
				if ($.isFunction(data))
					return initData(data(), callback);

				// if 'data' is string -> use it as URL for ajax request
				$.ajax({
					url: data + '',
					dataType: 'json',
					success: function(data, textStatus, jqXHR) {
						initData(data, callback);
					},
					error: function(jqXHR, textStatus, errorThrown) {
						// textStatus = timeout | error | abort | parsererror
						callback(undefined);
					}
				});
			}

			/**
			 * recognize dimensions in data array
			 * @param data, data array
			 */
			function recognizeDimensions(data) {
				var f = data[0], // get just first element
				    ret = {}, key, type;
				for (key in f) {
					type = typeof f[key];
					ret[key] = {
						type: type === 'boolean' || type === 'number' || type === 'string' ? type : 'unknown',
						filter: {}
					};
				}
				return ret;
			}

			/**
			 * normalize dimensions, e.g. unique columns and rows, etc
			 * @param d, object with dimensions, columns, rows and facts
			 */
			function normalizeDimensions(d, config) {
				var already = {}, i, l, columns = [], rows = [], facts = [], keys = [];
				// remove repeated columns and columns, absent in dimensions
				for (i = 0, l = d.columns.length; i < l; i++) {
					if (d.dimensions.hasOwnProperty(d.columns[i]) && !already.hasOwnProperty(d.columns[i])) {
						columns.push(d.columns[i]);
						already[d.columns[i]] = 1;
					}
				}
				// remove repeated rows and rows, absent in dimensions
				for (i = 0, l = d.rows.length; i < l; i++) {
					if (d.dimensions.hasOwnProperty(d.rows[i]) && !already.hasOwnProperty(d.rows[i])) {
						rows.push(d.rows[i]);
						already[d.rows[i]] = 1;
					}
				}
				// remove facts, absent in dimensions, and set default function
				for (i = 0, l = d.facts.length; i < l; i++)
					if (d.facts[i].by && d.dimensions.hasOwnProperty(d.facts[i].by))
						facts.push({
							by: d.facts[i].by,
							func: d.facts[i].func || config.defaultFunc
						});
				// set sortIndex for each dimension
				for (i in d.dimensions)
					keys.push(i);
				if ($.isFunction(config.sorter))
					keys.sort(config.sorter);
				else
					keys.sort();
				for (i = 0, l = keys.length; i < l; i++)
					if (d.dimensions[keys[i]].sortIndex === undefined)
						d.dimensions[keys[i]].sortIndex = (i + 1) * 5; // step 5, to leave empty positions for manual sorting
				// return normalized dimensions
				return {
					dimensions: d.dimensions,
					columns: columns,
					rows: rows,
					facts: facts
				};
			}

			// sort dimensions by sortindex and return array of objects with 'name' inside = key
			function sortDimensions(dimensions) {
				var key, ret = [];
				for (key in dimensions)
					ret.push($.extend({
						name: key
					}, dimensions[key]));
				return ret.sort(function(a,b) {
					return a.sortIndex - b.sortIndex;
				});
			}

			// sort object by dimension's sortIndex, return array without keys
			function sortByDimensions(obj, dimensions) {
				var key, i, l, ret0 = [], ret = [];
				// it will make vacuum array, but with right elements order
				for (key in dimensions)
					if (obj[key] === undefined || obj[key] === null)
						ret0[dimensions[key].sortIndex] = '';
					else
						ret0[dimensions[key].sortIndex] = obj[key];
				// compact array
				for (i = 0, l = ret0.length; i < l; i++)
					if (i in ret0)
						ret.push(ret0[i]);
				return ret;
			}

			// validate and cast filter to type
			function validateFilter(dimension) {
				if (dimension === undefined)
					return;

				var filter = dimension.filter,
				    type = dimension.type;

				// normalize value
				if (filter && filter.value !== undefined)
					switch (type) {
						case 'number':
							if ($.isArray(filter.value)) {
								filter.value[0] = +filter.value[0];
								filter.value[1] = +filter.value[1];
								if (isNaN(filter.value[0]))
									filter.value[0] = undefined;
								if (isNaN(filter.value[1]))
									filter.value[1] = undefined;
								if (filter.value[0] === undefined && filter.value[1] === undefined)
									filter.value = undefined;
							} else {
								filter.value = +filter.value;
								if (isNaN(filter.value))
									filter.value = undefined;
							}
							break;
						case 'date':
							if ($.isArray(filter.value)) {
								if (isNaN(Date.parse(filter.value[0])))
									filter.value[0] = undefined;
								if (isNaN(Date.parse(filter.value[1])))
									filter.value[1] = undefined;
							} else {
								if (isNaN(Date.parse(filter.value)))
									filter.value = undefined;
							}
							break;
						case 'boolean':
							filter.value = !!filter.value;
							break;
						// case 'string':
						// case 'unknown':
						default:
							filter.value = '' + filter.value;
					}
			}

			// get filter for dimension
			function getFilter(dimension) {
				validateFilter(dimension);
				if (dimension === undefined)
					return;

				var filter = dimension.filter;
				if (filter === undefined)
					dimension.filter = {};
				if (!filter || (filter.value === undefined && $.isEmptyObject(filter._exact))) // if there is no filter by this dimension
					return;
				return filter;
			}

			// generate <input> element for filter to show inside filter submenu
			function getFilterInputElement(dimension, comparison) {
				var filter = getFilter(dimension),
				    type = dimension.type,
				    value, gt, lt, eq;

				if (filter && filter.value !== undefined) {
					// get value
					switch (type) {
						case 'number':
						case 'date':
							if ($.isArray(filter.value)) {
								gt = filter.value[0];
								lt = filter.value[1];
							} else
								eq = filter.value;

							if (comparison === 'gt')
								value = gt;
							else
							if (comparison === 'lt')
								value = lt;
							else
								value = eq;

							break;
						// case 'boolean':
						// case 'string':
						// case 'unknown':
						default:
							value = filter.value;
					}
				}

				if (value === undefined)
					value = '';

				switch (type) {
					case 'number':
						return ['<input class="jqpivot-numberfilter" id="jqpivot-numberfilter-', comparison, '" name="', comparison, '" value="', value, '" />'].join('');
					case 'date':
						return ['<input class="jqpivot-datefilter" id="jqpivot-datefilter-', comparison, '" name="', comparison, '" value="', value, '" />'].join('');
					case 'boolean':
						return ['<input type="radio" class="jqpivot-booleanfilter" id="jqpivot-booleanfilter-', comparison, '" name="boolean" value="', comparison, '" ', ('' + value === comparison ? 'checked="checked"' : ''), ' />'].join('');
					// case 'string':
					// case 'unknown':
					default:
						return ['<input class="jqpivot-stringfilter" autofocus="autofocus" name="string" value="', value, '" />'].join(''); // <-- replace " to \" ?
				}
			}

			// get all values for dimension
			function getFilterAllValues(dimension, name, data) {
				var values = {};
				// go through all data and get all values for dimension
				for (var i = data.length; i--;)
					if (data[i][name] || data[i][name] === 0)
						values[data[i][name]] = 1;
				// save values in filter
				dimension.filter._all = values;
			}

			// generate <table> with all dimension values, to show inside filter submenu
			function getFilterAllValuesTable(dimension, name, data) {
				// fill, if not filled yet
				if (!dimension.filter._all)
					getFilterAllValues(dimension, name, data);
				if (dimension.filter._exact === undefined)
					dimension.filter._exact = {};
				// generate table
				var $ret = $('<table />'), cbid;
				for (var value in dimension.filter._all) {
					cbid = 'jqpivot-checkboxfilter-' + value.replace(/\s/g,'_');
					$ret.append(
						$('<tr />').append([
							$('<td />').append(
								$('<input />', {
									type: 'checkbox',
									id: cbid,
									value: value,
									checked: value in dimension.filter._exact
								})
							),
							$('<td />').append(
								$('<label />', {
									'for': cbid,
									html: value
								})
							)
						])
					);
				}
				return $ret;
			}

			// check if object can pass filters or not
			function isPassThroughFilters(obj, dimensions) {

				function isPassThroughFilter(value, type, filter) {
					// no filter by this dimension
					if (!filter)
						return true;

					// if filter is empty, but filled _exact map!
					// and value is not in that map, because otherwise this function wouldn't be called
					if (filter.value === undefined && filter._exact !== undefined && !$.isEmptyObject(filter._exact))
						return false;

					// filter is empty
					if (filter.value === undefined)
						return true;

					switch (type) {
						case 'number':
							// if value is not a number -> not pass
							if (isNaN(+value))
								return false;
							if ($.isArray(filter.value)) {
								// if value < 'gt' -> not pass
								if (filter.value[0] !== undefined && +value < filter.value[0])
									return false;
								// if value > 'lt' -> not pass
								if (filter.value[1] !== undefined && +value > filter.value[1])
									return false;
							} else {
								// if value != 'eq' -> not pass
								if (+value !== filter.value)
									return false;
							}
							break;
						case 'date':
							// if value is not a date -> not pass
							if (isNaN(Date.parse(value)))
								return false;
							var fvalue,
							    dvalue = new Date(value);
							dvalue.setHours(0,0,0,0); // do it because don't want compare hours/minutes/seconds/milliseconds
							if ($.isArray(filter.value)) {
								// if value < 'gt' -> not pass
								if (filter.value[0] !== undefined) {
									fvalue = new Date(filter.value[0]);
									fvalue.setHours(0,0,0,0);
									if (dvalue.getTime() < fvalue.getTime())
										return false;
								}
								// if value > 'lt' -> not pass
								if (filter.value[1] !== undefined) {
									fvalue = new Date(filter.value[1]);
									fvalue.setHours(0,0,0,0);
									if (dvalue.getTime() > fvalue.getTime())
										return false;
								}
							} else {
								// if value != 'eq' -> not pass
								fvalue = new Date(filter.value);
								fvalue.setHours(0,0,0,0);
								if (dvalue.getTime() !== fvalue.getTime())
									return false;
							}
							break;
						case 'boolean':
							// if value != filter value -> not pass
							if (!!value !== filter.value)
								return false;
							break;
						// case 'string':
						// case 'unknown':
						default:
							// if inside value there is no filter substring -> not pass
							if ((value + '').toLowerCase().indexOf(filter.value.toLowerCase()) === -1)
								return false;
					}

					// pass
					return true;
				}

				// check all object properties
				for (var key in obj) {
					// if there is no such dimension -> object pass
					if (dimensions[key] === undefined)
						continue;
					// if value contains in _exact -> object pass
					if (dimensions[key].filter._exact !== undefined && obj[key] in dimensions[key].filter._exact)
						continue;
					// check filter
					if (!isPassThroughFilter(obj[key], dimensions[key].type, dimensions[key].filter))
						return false;
				}

				return true;
			}

			/**
			 * calculate result table and create it
			 * @param $this, jquery root jqpivot object
			 */
			function calculatePivotTable($this) {
				var jqpivot = $this.data('jqpivot'),
				    $td = $this.find('.jqpivot-table'),
				    $oldTable = $td.children('table'),
				    $calculating = $('<div class="jqpivot-calculating"><span>calculating</span></div>');

				// write "calculating" label
				if ($oldTable.length !== 0) {
					var position = $oldTable.position(),
					    height = $oldTable.outerHeight(),
					    width = $oldTable.outerWidth();
					$calculating
						.addClass('jqpivot-calculating-table')
						.css({
							'top': position.top,
							'left': position.left,
							'width': width,
							'height': height,
							'line-height': height + 'px'
						});
				}
				$td.append($calculating);

				// rise 'start' event
				rise($this, 'start');

				// remove details table
				var removed = $this.find('> table.jqpivot-details').remove();
				$this.find('.jqpivot-td-details').removeClass('jqpivot-td-details');

				// rise 'hidedetails' event
				if (removed.length !== 0)
					rise($this, 'hidedetails');

				// table cell click event listener
				function tableCellClickEventListener() {
					// remove details table
					var removed = $this.find('> table.jqpivot-details').remove();
					$this.find('.jqpivot-td-details').removeClass('jqpivot-td-details');

					// rise 'hidedetails' event
					if (removed.length !== 0)
						rise($this, 'hidedetails', $table);

					var $me = $(this),
					    data = $me.data('data');

					// if there is no array of data -> just do nothing
					if (!data || !$.isArray(data) || data.length === 0)
						return;

					var $table = $('<table class="jqpivot-details" />'),
					    $tr = $('<tr />'),
					    dimensions = jqpivot.d.dimensions,
					    dimensionsArr = sortDimensions(dimensions),
					    rArr, i, l, j;

					// header
					for (i = 0, l = dimensionsArr.length; i < l; i++)
						$tr.append(
							$('<th />', {
								text: dimensionsArr[i].name
							})
						);
					$table.append(
						$('<thead />').append($tr)
					);

					// content
					for (i = 0, l = data.length; i < l; i++) {
						$tr = $('<tr />');
						rArr = sortByDimensions(data[i], dimensions);
						for (j = 0; j < rArr.length; j++)
							$tr.append(
								$('<td />', {
									'class': 'jqpivot-td-type-' + dimensionsArr[j].type,
									html: rArr[j]
								})
							);
						$table.append($tr);
					}

					// add details table
					$this.append($table);
					$me.addClass('jqpivot-td-details');

					// add new floating header
					if ($().stickyTableHeaders)
						$table.stickyTableHeaders();

					// rise 'showdetails' event
					rise($this, 'showdetails', $table);

				}

				// calculate

				window.setTimeout(function() {

				var $table = $('<table />'),
				    facts = jqpivot.d.facts,
				    factsIndexes = {},
				    columns = jqpivot.d.columns,
				    rows = jqpivot.d.rows,
				    dimensions = jqpivot.d.dimensions,
				    axes = columns.concat(rows),
				    columnsCount = columns.length,
				    rowsCount = rows.length,
				    factsCount = facts.length,
				    aColumns = [], aRows = [],
				    data = {},
				    dname, dvalue, pdata, o,
				    i, j, z,
				    success = true;

				function getFactIndex(name) {
					if (name in factsIndexes)
						return factsIndexes[name];
					for (var i = 0; i < facts.length; i++)
						if (facts[i].by + ' (' + facts[i].func + ')' === name) {
							factsIndexes[name] = i;
							return i;
						}
					factsIndexes[name] = -1;
					return -1;
				}

				calculation: {

					// columns and Rows dimensions are empty!
					if (axes.length === 0) {
						$table.append('<tr><td class="jqpivot-td-empty">Columns and Rows dimensions are empty</td></tr>');
						success = false;
						break calculation;
					}

					// data dimensions are empty!
					if (factsCount === 0) {
						$table.append('<tr><td class="jqpivot-td-empty">Data dimensions are empty</td></tr>');
						success = false;
						break calculation;
					}

					// go through all data array and place objects to arrays by needed dimensions
					object:
					for (i = jqpivot.data.length; i--;) {
						o = jqpivot.data[i];
						// check filters
						if (!isPassThroughFilters(o, dimensions))
							continue;
						// object passes filters -> add it and calculate
						pdata = data;
						for (j = 0; j < axes.length; j++) {
							dname = axes[j];
							dvalue = o[dname]; // <-- aggregation here?
							if (dvalue === undefined || dvalue === null || dvalue === '')
								dvalue = '-'; // continue object; // skip this object and go to next one
							if (!pdata.hasOwnProperty(dvalue))
								pdata[dvalue] = (j+1 === axes.length) ? [] : {};
							pdata = pdata[dvalue];
						}
						pdata.push(o);
					}

					// function-helper to retrieve data
					data.__getByPath = function(path, obj) {
						var path0 = path.slice(0),
						    part,
						    got = true,
						    ret = this;
						while (path0.length) {
							part = path0.shift();
							if (ret.hasOwnProperty(part)) {
								ret = ret[part];
							} else {
								got = false;
								break;
							}
						}
						if ($.isArray(ret)) {
							obj.arr = ret;
							if (!got) {
								obj.i = getFactIndex(part);
								return ret.facts[part];
							} else {
								for (part in ret.facts) {
									obj.i = getFactIndex(part);
									return ret.facts[part];
								}
							}
						}
					};

					// calculate data functions on each array
					// and also fill columns and rows arrays
					(function() {

						// get full path and divide it to columns/rows arrays
						function slicePath(path) {
							if (columnsCount > 0)
								aColumns.push(path.slice(0, columnsCount));
							if (rowsCount + factsCount > 0)
								aRows.push(path.slice(columnsCount, (rowsCount > 0 && factsCount === 1) ? -1 : path.length));
						}

						// check equality of plain arrays
						function isArrsEqual(arr1, arr2) {
							if (arr1.length !== arr2.length)
								return false;
							for (var i = arr1.length; i--;)
								if (arr1[i] !== arr2[i])
									return false;
							return true;
						}

						// remove from 2 dimensional array not unique arrays
						// e.g. [[1,2,3],[2,3],[3,1],[1,2,3],[3,1],[2,3]] -> [[1,2,3],[2,3],[3,1]]
						function uniqArrayOfArray(arr) {
							var ret = [], i, j, uniq;
							for (i = 0; i < arr.length; i++) {
								uniq = true;
								for (j = 0; j < ret.length; j++)
									if (isArrsEqual(arr[i], ret[j])) {
										uniq = false;
										break;
									}
								if (uniq)
									ret.push(arr[i]);
							}
							return ret;
						}

						function uniqColumnsRows() {
							aColumns = uniqArrayOfArray(aColumns);
							aRows = uniqArrayOfArray(aRows);
						}

						// traverse recursively via data, call aggregation function
						function traverse(data, path) {
							var key, i, by, func, path0;
							for (key in data) {
								path0 = path.concat(key);
								if (!$.isArray(data[key])) {
									traverse(data[key], path0); // we need to go deeper!
								} else {
									data[key].facts = {};
									for (i = 0; i < facts.length; i++) {
										by = facts[i].by;
										func = facts[i].func;
										slicePath(path0.concat(by + ' (' + func + ')'));
										if ($.isFunction($.jqpivot.functions[func]))
											data[key].facts[by + ' (' + func + ')'] = $.jqpivot.functions[func].call($this, data[key], by); // call aggregation function
									}
								}
							}
						}

						traverse(data, []);
						uniqColumnsRows();
					})();

					// there is no data for this filters!
					if (aRows.length === 0) {
						$table.append('<tr><td class="jqpivot-td-empty">There is no data to show in table</td></tr>');
						success = false;
						break calculation;
					}

					// sort columns and rows
					(function() {

						function createSorter(order, type) {
							return function(a,b) {
								if (type === 'number') {
									a = +a;
									b = +b;
								}
								return a > b ? order : (a < b ? -order : 0);
							};
						}

						var i, sorters = [];

						// sort columns
						for (i = 0; i < columns.length; i++)
							sorters.push(createSorter(dimensions[columns[i]].sort === 'desc' ? -1 : +1, dimensions[columns[i]].type));
						aColumns.sort(function(a,b) {
							var i, ret, to = Math.min(a.length, sorters.length); // a.length should be = b.length
							for (i = 0; i < to; i++) {
								ret = sorters[i](a[i], b[i]);
								if (ret !== 0)
									return ret;
							}
							return 0;
						});

						// sort rows
						sorters.length = 0;
						for (i = 0; i < rows.length; i++)
							sorters.push(createSorter(dimensions[rows[i]].sort === 'desc' ? -1 : +1, dimensions[rows[i]].type));
						if (rows.length < aRows[0].length)
							sorters.push(function(a,b) {
								return getFactIndex(a) - getFactIndex(b);
							});
						aRows.sort(function(a,b) {
							var i, ret, to = Math.min(a.length, sorters.length); // a.length should be = b.length
							for (i = 0; i < to; i++) {
								ret = sorters[i](a[i], b[i]);
								if (ret !== 0)
									return ret;
							}
							return 0;
						});

					})();

					// create table
					var $row,
					    $thead = $('<thead />');

					// append columns header
					for (j = 0; j < (aColumns.length === 0 ? 1 : aColumns[0].length); j++) {
						$row = $('<tr />');
						for (z = 0; z < aRows[0].length; z++) // aRows contains at least 1 row
							$row.append($('<th />' , {
								'class': 'jqpivot-td-empty ' + (z+1 === aRows[0].length ? 'jqpivot-td-rheader-right' : '')
							}));
						for (i = 0; i < aColumns.length; i++)
							$row.append($('<th />' , {
								'class': 'jqpivot-td-bold jqpivot-td-cheader jqpivot-td-header',
								text: aColumns[i][j]
							}));
						if (aColumns.length === 0 || j+1 === aColumns[0].length)
							$row.append('<th class="jqpivot-td-empty jqpivot-td-bold jqpivot-td-cheader jqpivot-td-total">total</td>');
						else
							$row.append('<th class="jqpivot-td-empty" />');
						$thead.append($row);
					}
					$row.find('> th').addClass('jqpivot-td-cheader-bottom');
					$table.append($thead);

					// append rows header with data
					var columnsData = [],
					    rowsData = [],
					    factIndex;
					for (j = 0; j < aRows.length; j++) {
						$row = $('<tr />');
						for (z = 0; z < aRows[0].length; z++)
							$row.append($('<td />' , {
								'class': 'jqpivot-td-bold jqpivot-td-rheader jqpivot-td-header ' + (z+1 === aRows[0].length ? 'jqpivot-td-rheader-right' : ''),
								text: aRows[j][z]
							}));
						for (i = 0; i < (aColumns.length || 1); i++) {
							var obj = {},
							    val = data.__getByPath(aColumns.length > 0 ? aColumns[i].concat(aRows[j]) : aRows[j], obj);
							// if don't show zeros, and value is zero -> emptify it and objects array
							if (!jqpivot.config.showZeros && (val === 0 || val === null || val === undefined || val === '')) {
								val = '';
								if (obj.arr)
									obj.arr = [];
							}

							$row.append(
								$('<td />' , {
									'class': 'jqpivot-td-data ' +
										(aColumns.length > 0 ? '' : 'jqpivot-td-bold jqpivot-td-cheader jqpivot-td-total') +
										(i % 3 === 2 ? ' jqpivot-td-coleven' : '') +
										(j % 2 === 1 ? ' jqpivot-td-roweven' : ''),
									text: val,
									click: tableCellClickEventListener
								}).data('data', obj.arr)
							);

							// count total
							if (val === 0 || val === null || val === undefined || val === '')
								val = 0;
							// count total values by columns
							if (!columnsData[i])
								columnsData[i] = [];
							if (obj.i !== undefined) {
								factIndex = obj.i;
								columnsData[i][factIndex] = columnsData[i][factIndex] ? {
									val: val + columnsData[i][factIndex].val,
									arr: obj.arr ? (columnsData[i][factIndex].arr ? columnsData[i][factIndex].arr.concat(obj.arr) : obj.arr) : columnsData[i][factIndex].arr
								} : {
									val: val,
									arr: obj.arr
								};
							}
							// count total values by rows
							rowsData[j] = rowsData[j] ? {
								val: val + rowsData[j].val,
								arr: obj.arr ? (rowsData[j].arr ? rowsData[j].arr.concat(obj.arr) : obj.arr) : rowsData[j].arr
							} : {
								val: val,
								arr: obj.arr
							};
						}
						// count total values by columns
						if (!columnsData[i])
							columnsData[i] = [];
						if (factIndex !== undefined)
							columnsData[i][factIndex] = columnsData[i][factIndex] ? {
								val: rowsData[j].val + columnsData[i][factIndex].val,
								arr: rowsData[j].arr ? (columnsData[i][factIndex].arr ? columnsData[i][factIndex].arr.concat(rowsData[j].arr) : rowsData[j].arr) : columnsData[i][factIndex].arr
							} : {
								val: rowsData[j].val,
								arr: rowsData[j].arr
							};
						// add total column values
						if (aColumns.length > 0)
							$row.append(
								$('<td />', {
									'class': 'jqpivot-td-data jqpivot-td-bold jqpivot-td-cheader jqpivot-td-total' +
										(j % 2 === 1 ? ' jqpivot-td-roweven' : ''),
									text: rowsData[j].val,
									click: tableCellClickEventListener
								}).data('data', rowsData[j].arr)
							);
						$table.append($row);
					}

					// append last total row
					for (j = 0; j < facts.length; j++) {
						$row = $('<tr />');
						// add empty cells
						for (z = 0; z < aRows[0].length - 1; z++) // aRows contains at least 1 row
							$row.append('<td class="jqpivot-td-empty" />');
						// add header
						$row.append(
							$('<td />', {
								'class': 'jqpivot-td-empty jqpivot-td-bold jqpivot-td-rheader jqpivot-td-total jqpivot-td-rheader-right',
								text: facts.length === 1 ? 'total' : facts[j].by + ' (' + facts[j].func + ')'
							})
						);
						// add total values
						for (i = 0; i < aColumns.length + 1; i++)
							$row.append(
								$('<td />', {
									'class': 'jqpivot-td-data jqpivot-td-bold jqpivot-td-rheader jqpivot-td-total ' +
										(i === aColumns.length ? 'jqpivot-td-cheader' : '') +
										(i % 3 === 2 ? ' jqpivot-td-coleven' : ''),
									text: columnsData[i][j] ? columnsData[i][j].val : '0',
									click: tableCellClickEventListener
								}).data('data', columnsData[i][j] ? columnsData[i][j].arr : undefined)
							);
						// add top border
						if (j === 0)
							$row.find('> td.jqpivot-td-bold').addClass('jqpivot-td-rheader-top');
						$table.append($row);
					}

					// merge cells
					var domTable = $table[0],
					    domRows = domTable.rows,
					    domCells,
					    $cell,
					    $bigcell,
					    text, rowspan, colspan;
					// through column's headers
					for (j = 0; j < (aColumns.length === 0 ? 1 : aColumns[0].length); j++) {
						domCells = domRows[j].cells;
						text = undefined;
						colspan = 1;
						for (i = 0, z = domCells.length; i < z; i++) {
							$cell = $(domCells[i]);
							if (text !== $cell.text()) {
								$bigcell = $cell;
								text = $cell.text();
								colspan = 1;
							} else {
								colspan++;
								$bigcell.data('colspan', colspan);
								$cell.data('todelete', true);
							}
						}
					}
					// through row's headers
					for (i = 0, z = aRows[0].length; i < z; i++) {
						text = undefined;
						rowspan = 1;
						for (j = 0; j < aRows.length; j++) {
							domCells = domRows[j + (aColumns.length === 0 ? 1 : aColumns[0].length)].cells;
							$cell = $(domCells[i]);
							if (text !== $cell.text()) {
								$bigcell = $cell;
								text = $cell.text();
								rowspan = 1;
							} else {
								rowspan++;
								$bigcell.data('rowspan', rowspan);
								$cell.data('todelete', true);
							}
						}
					}
					// modify header's cells
					$table.find('.jqpivot-td-bold').each(function() {
						var $me = $(this),
						    data = $me.data(),
						    rowspan = data.rowspan,
						    colspan = data.colspan,
						    todelete = data.todelete;
						if (rowspan)
							$me.attr('rowspan', rowspan);
						else
						if (colspan)
							$me.attr('colspan', colspan);
						else
						if (todelete)
							$me.remove();
					});

				} // 'calculation' block

				// remove "calculating" label and print result table
				$td.find('.jqpivot-calculating').remove();
				if ($oldTable.length !== 0)
					$oldTable.replaceWith($table);
				else
					$td.append($table);

				// add new floating header
				if (success && $().stickyTableHeaders)
					$table.stickyTableHeaders();

				// if 'onready' callback is set -> call it
				if (success)
					rise($this, 'ready', $table);

				}, 100);
			}

			/**
			 * create DOM structure
			 * @param $this, jquery root jqpivot object
			 * @param d, object with dimensions, columns, rows and facts
			 */
			function createDOM($this, d, config) {
				$this.empty();

				// create dimension button
				function createDimension(name, func) {
					return $('<div />', {
						'class': 'jqpivot-d',
						'data-name': name // this, as opposed to $.data('name', name), allows to get 'data-name' via $.attr('data-name')
					}).append(
						$('<span/>', {
							text: name
						})
					).data('func', func);
				}

				var $wrapperTable = $('<table />', { 'class': 'jqpivot-wrapper' }),
				    $dimensionsTd = $('<td />',    { 'class': 'jqpivot-dimensions', align: 'right' }),
				    $columnsTd    = $('<td />',    { 'class': 'jqpivot-columns' }),
				    $rowsTd       = $('<td />',    { 'class': 'jqpivot-rows', align: 'right' }),
				    $tableTd      = $('<td />',    { 'class': 'jqpivot-table' }),
				    $dataDiv      = $('<div />',   { 'class': 'jqpivot-data ui-helper-clearfix' }),
				    i, l, name,
				    $dimensions = $dimensionsTd,
				    $data = $dataDiv,
				    $columns = $columnsTd,
				    $rows = $rowsTd,
				    updateTimeoutId;

				// append dimensions buttons
				var dimensionsArr = sortDimensions(d.dimensions);
				for (i = 0, l = dimensionsArr.length; i < l; i++)
					$dimensionsTd.append(createDimension(dimensionsArr[i].name));
				for (i = 0, l = d.columns.length; i < l; i++)
					$columnsTd.append(createDimension(d.columns[i]));
				for (i = 0, l = d.rows.length; i < l; i++)
					$rowsTd.append(createDimension(d.rows[i]));
				for (i = 0, l = d.facts.length; i < l; i++)
					if (d.facts[i].by)
						$dataDiv.append(createDimension(d.facts[i].by, d.facts[i].func || config.defaultFunc));

				// create and append main table
				$this.append(
					$wrapperTable.append(
						$('<tr />')
							.append($dimensionsTd)
							.append($columnsTd
								.append($('<div class="jqpivot-floatfix" />'))
							)
					).append(
						$('<tr />')
							.append($rowsTd)
							.append($tableTd
								.append($dataDiv
									.append($('<div class="jqpivot-floatfix" />'))
								)
								.append($('<div style="clear: left" />'))
							)
					)
				);
				updateDimensions(d);

				function updateDimensions(d) {
					var jqpivot = $this.data('jqpivot'),
					    d = d || (jqpivot ? jqpivot.d : undefined);

					// update facts dimension buttons,
					// show function for each one
					$data.find('.jqpivot-d').each(function() {
						var $el = $(this),
						    name = $el.data('name'),
						    func = $el.data('func');
						if (name === undefined)
							return;
						$el.find('> span').find('.jqpivot-menu').remove().end()
							.append(
								$('<span />', {
									'class': 'jqpivot-menu',
									text: func
								})
							);
					});
					// update filters dimension buttons,
					// show submenu button
					$dimensions.find('.jqpivot-d').each(function() {
						var $el = $(this),
						    name = $el.data('name');
						if (name === undefined)
							return;
						$el.find('> span').find('.jqpivot-menu').remove().end()
							.append(
								$('<span />', {
									'class': 'jqpivot-menu',
									html: '&#9660;' // &#9650;
								}).addClass(
									d && getFilter(d.dimensions[name]) ?
										'jqpivot-menu-changed' :
										undefined
								)
							);
					});
					// update column and row dimension buttons,
					// show sort order for each one
					$columns.add($rows).find('.jqpivot-d').each(function() {
						var $el = $(this),
						    name = $el.data('name');
						if (name === undefined)
							return;
						$el.find('> span').find('.jqpivot-menu').remove().end()
							.append(
								$('<span />', {
									'class': 'jqpivot-menu',
									html: d && d.dimensions[name].sort === 'desc' ? '&darr;' : '&uarr;'
								})
							);
					});
				}

				function hideAllSubmenus() {
					$this.find('.jqpivot-d > div').remove(); //FIXME memory leak? 'cause of using data
					$dimensions.find('.jqpivot-d .jqpivot-menu').html('&#9660;');
				}

				// add drag'n'drop to dimensions buttons

				// check if dimension is unique in both columns and rows
				function isUniqueDimension(name) {
					var dc = 0, i,
					    dcarr = $columns.sortable('toArray', { attribute: 'data-name' }),
					    drarr = $rows.sortable('toArray', { attribute: 'data-name' });
					for (i = dcarr.length; i--;)
						if (dcarr[i] === name)
							dc++;
					for (i = drarr.length; i--;)
						if (drarr[i] === name)
							dc++;
					return dc <= 1; // can be === 0 if we throw out dimension from data sortable
				}

				// check equality of sortable dimensions buttons and internal real dimensions
				function isDimensionsEqual(d, arr) {
					if (d.length !== arr.length)
						return false;
					if (d.length === 0)
						return true;
					var by = d[0].by;
					for (var i = d.length; i--;)
						if ((!by && d[i] !== arr[i]) || (by && by !== arr[i]))
							return false;
					return true;
				}

				// start drag dimension
				function startEventListener(e, ui) {
					hideAllSubmenus();
				}

				// stop drag dimension
				function stopEventListener(e, ui) {
					if ($(this).has(ui.item).length > 0) // if ui.item is descendant of this sortable
						if (!isUniqueDimension(ui.item.data('name')))
							ui.item.remove();
				}

				// sortable receives new dimension
				function receiveEventListener(e, ui) {
					if (ui.sender.is('.jqpivot-data'))
						if (!isUniqueDimension(ui.item.data('name')))
							ui.sender.sortable('cancel');
				}

				// sortable updates
				function updateEventListener(e, ui) {
					// we need timeout because of moving dimensions from one sortable to another -> it fires two update events
					window.clearTimeout(updateTimeoutId);
					updateTimeoutId = window.setTimeout(function() {
						var jqpivot = $this.data('jqpivot'),
						    d = jqpivot.d,
						    notEmpty = function(value) { return value !== '' },
						    ddarr = $data.sortable('toArray', { attribute: 'data-name' }).filter(notEmpty),
						    dcarr = $columns.sortable('toArray', { attribute: 'data-name' }).filter(notEmpty),
						    drarr = $rows.sortable('toArray', { attribute: 'data-name' }).filter(notEmpty),
						    ischanged = false;

						if (!isDimensionsEqual(d.columns, dcarr)) {
							ischanged = true;
							d.columns = dcarr;
						}
						if (!isDimensionsEqual(d.rows, drarr)) {
							ischanged = true;
							d.rows = drarr;
						}
						//FIXME if we change facts with same name but different functons -> this'll return that dimensions are equal
						if (!isDimensionsEqual(d.facts, ddarr)) {
							ischanged = true;
							var facts = [];
							$data.find('.jqpivot-d').each(function() {
								var $el = $(this),
								    name = $el.data('name'),
								    func = $el.data('func');
								if (name === undefined)
									return;
								if (func === undefined)
									$el.data('func', config.defaultFunc);
								facts.push({
									by: name,
									func: func || config.defaultFunc
								});
							});
							d.facts = facts;
						}
						if (ischanged) {
							updateDimensions(d);
							calculatePivotTable($this);
						}
					}, 200);
				}

				// click to new data function from drop down submenu
				function setFactsFunctionEventListener() {
					var jqpivot = $this.data('jqpivot'),
					    d = jqpivot.d,
					    data = $(this).data(),
					    facts = [];

					hideAllSubmenus();

					// if function is unchanged -> do nothing
					if (data.el.data('func') === data.name)
						return;

					data.el.data('func', data.name);
					$data.find('.jqpivot-d').each(function() {
						var $el = $(this),
						    name = $el.data('name'),
						    func = $el.data('func');
						if (name === undefined)
							return;
						if (func === undefined)
							$el.data('func', config.defaultFunc);
						facts.push({
							by: name,
							func: func || config.defaultFunc
						});
					});
					d.facts = facts;

					updateDimensions();
					calculatePivotTable($this);
				}

				// $this.find('.jqpivot-d').disableSelection();

				// activate jqueryui sortable on facts dimensions
				$data.sortable({ // === $this.find('.jqpivot-data').sortable({
					appendTo: $this,
					cursor: 'move',
					handle: '> span',
					tolerance: 'pointer',
					start: startEventListener,
					update: updateEventListener,
					connectWith: '.jqpivot-columns, .jqpivot-rows'
				});
				// activate jqueryui sortable on columns dimensions
				$columns.sortable({ // === $this.find('.jqpivot-columns').sortable({
					appendTo: $this,
					cursor: 'move',
					handle: '> span',
					tolerance: 'pointer',
					start: startEventListener,
					stop: stopEventListener,
					receive: receiveEventListener,
					update: updateEventListener,
					connectWith: '.jqpivot-rows, .jqpivot-data'
				});
				// activate jqueryui sortable on rows dimensions
				$rows.sortable({ // === $this.find('.jqpivot-rows').sortable({
					appendTo: $this,
					cursor: 'move',
					handle: '> span',
					tolerance: 'pointer',
					start: startEventListener,
					stop: stopEventListener,
					receive: receiveEventListener,
					update: updateEventListener,
					helper: function(e, $el) { // this fixes helper size
						var width = $el.width();
						return $el.clone().css({
							'width': width,
							'text-align': 'right'
						});
					},
					connectWith: '.jqpivot-columns, .jqpivot-data'
				});

				// activate jqueryui draggable on filters dimensions
				$this.find('.jqpivot-dimensions > div').draggable({
					appendTo: $this,
					cursor: 'move',
					handle: '> span',
					tolerance: 'pointer',
					start: startEventListener,
					helper: function() { // this fixes helper size
						var $el = $(this),
						    width = $el.width();
						return $(this).clone().css({
							'width': width,
							'text-align': 'right'
						});
					},
					connectToSortable: '.jqpivot-columns, .jqpivot-rows, .jqpivot-data'
				});

				// activate jqueryui droppable on trash, to allow throw out dimensions
				$this.find('.jqpivot-dimensions').droppable({
					accept: '.jqpivot-d:not(.jqpivot-dimensions > div)',
					hoverClass: "jqpivot-trash",
					tolerance: 'pointer',
					over: function(e, ui) {
						$('.jqpivot-d.ui-sortable-placeholder').hide();
					},
					out: function(e, ui) {
						$('.jqpivot-d.ui-sortable-placeholder').show();
					},
					drop: function(e, ui) {
						ui.draggable.remove();
					}
				});

				// add submenu click listener

				$this.on('click.jqpivot', function(e) {
					if ($(e.target).parents('.jqpivot-d').length === 0)
						hideAllSubmenus();
				});
				$this.on('click.jqpivot', '.jqpivot-menu', function() {
					var jqpivot = $this.data('jqpivot'),
					    d = jqpivot.d,
					    $el = $(this),
					    $span = $el.parent(),
					    $menubtn = $span.children('.jqpivot-menu'),
					    menubtn0cc = $menubtn.html().charCodeAt(0),
					    $dimension = $span.parent(),
					    height = $span.outerHeight(),
					    width = $span.outerWidth(),
					    left = $span.position().left,
					    name = $dimension.data('name'),
					    dimension = d.dimensions[name];

					hideAllSubmenus();

					// &#9650; - this is triangle to up
					if (menubtn0cc === 9650)
						return;

					// if this is descendant of filters
					if ($dimensions.has(this).length > 0) {
						$menubtn.html('&#9650;');

						var $fix = $('<div class="jqpivot-submenu-border-fix" />');
						var $menu = $('<div />', {
							'class': 'jqpivot-submenu',
							append: function() {
								var $ret = $('<div />'),
								    type = dimension.type,
								    filter = dimension.filter,
								    isAddAllValues = true;
								switch (type) {
									case 'number':
										$ret.append([
											'<table>',
											// >
											'<tr>',
											 '<td><label for="jqpivot-numberfilter-gt"><b>&ge;</b></label></td>',
											 '<td>', getFilterInputElement(dimension, 'gt'), '</td>',
											'</tr>',
											// <
											'<tr>',
											 '<td><label for="jqpivot-numberfilter-lt"><b>&le;</b></label></td>',
											 '<td>', getFilterInputElement(dimension, 'lt'), '</td>',
											'</tr>',
											'</table>',
											'<hr />',
											'<table>',
											// =
											'<tr>',
											 '<td><label for="jqpivot-numberfilter-eq"><b>=</b></label></td>',
											 '<td>', getFilterInputElement(dimension, 'eq'), '</td>',
											'</tr>',
											'</table>'
										].join(''));
										break;
									case 'date':
										$ret.append([
											'<table>',
											// after
											'<tr>',
											 '<td width="50"><label for="jqpivot-datefilter-gt">after</label></td>',
											 '<td>', getFilterInputElement(dimension, 'gt'), '</td>',
											'</tr>',
											// before
											'<tr>',
											 '<td width="50"><label for="jqpivot-datefilter-lt">before</label></td>',
											 '<td>', getFilterInputElement(dimension, 'lt'), '</td>',
											'</tr>',
											'</table>',
											'<hr />',
											'<table>',
											// on
											'<tr>',
											 '<td width="50"><label for="jqpivot-datefilter-eq">on</label></td>',
											 '<td>', getFilterInputElement(dimension, 'eq'), '</td>',
											'</tr>',
											'</table>'
										].join(''));
										break;
									case 'boolean':
										$ret.append([
											'<table>',
											// true
											'<tr>',
											 '<td>', getFilterInputElement(dimension, 'true'), '</td>',
											 '<td><label for="jqpivot-booleanfilter-true">true</label></td>',
											'</tr>',
											// false
											'<tr>',
											 '<td>', getFilterInputElement(dimension, 'false'), '</td>',
											 '<td><label for="jqpivot-booleanfilter-false">false</label></td>',
											'</tr>',
											'</table>'
										].join(''));
										isAddAllValues = false;
										break;
									// case 'string':
									// case 'unknown':
									default:
										$ret.append(
											getFilterInputElement(dimension)
										);
								}
								if (isAddAllValues)
									$ret.append([
										'<div class="jqpivot-filters-allvalues">',
										 '<div class="jqpivot-filters-header">all values</div>',
										 '<div class="jqpivot-filters-values"></div>',
										'</div>'
									].join(''));
								$ret.append([
									'<div class="jqpivot-filters-buttons">',
									 '<button value="clear">clear</button>',
									 '<button value="set">set</button>',
									'</div>'
								].join(''));
								return $ret;
							}
						});

						// append and show menu
						$dimension
							.append($fix)
							.append($menu);

						var menuWidth = $menu.outerWidth();
						$fix.width(Math.min(width, menuWidth) - 2).css({
							top: height - 1
						});
						$menu.css({
							top: height - 1,
							right: width <= menuWidth ? 'auto' : 0,
							left: width <= menuWidth ? left : 'auto'
						}).show();

						// activate controls

						// append calendars to date filter
						$menu.find('.jqpivot-datefilter').datepicker({
							changeMonth: true,
							changeYear: true
						}).end()

						// activate 'all values' button
						.find('.jqpivot-filters-header').on('click.jqpivot', function() {
							var $values = $(this).next('.jqpivot-filters-values'),
							    isfilled = $values.hasClass('jqpivot-filters-values-filled');
							// fill all values with data
							if (!isfilled)
								$values.append(
									getFilterAllValuesTable(dimension, name, jqpivot.data)
								).addClass('jqpivot-filters-values-filled');
							// show or hide values
							$values.toggle();
						}).end()

						// activate 'clear' and 'set' buttons
						.find('button').on('click.jqpivot', function() {
							hideAllSubmenus();

							// clear filter by this dimension
							delete dimension.filter.value;
							delete dimension.filter._exact;

							// set filter by this dimension
							if (this.value === 'set') {
								$menu.find('input')
									// text filter (number/date/string/unknown)
									.filter(':text')
										.each(function() {
											var $me = $(this),
											    fvalue = $.trim($me.val()),
											    fname = $me.attr('name');
											if (fvalue !== '')
												switch (fname) {
													case 'gt':
														if (dimension.filter.value === undefined)
															dimension.filter.value = [fvalue]; else
														if ($.isArray(dimension.filter.value))
															dimension.filter.value[0] = fvalue;
														break;
													case 'lt':
														if (dimension.filter.value === undefined)
															dimension.filter.value = [undefined, fvalue]; else
														if ($.isArray(dimension.filter.value))
															dimension.filter.value[1] = fvalue;
														break;
													case 'eq':
													case 'string':
														dimension.filter.value = fvalue;
												}
										}).end()
									// boolean filter
									.filter(':radio:checked')
										.each(function() {
											var fvalue = $(this).val() === 'true' ? true : false;
											dimension.filter.value = fvalue;
										}).end()
									// go through all values and fill _exact filter
									.filter(':checkbox:checked')
										.each(function() {
											var fvalue = $(this).val();
											if (dimension.filter._exact === undefined)
												dimension.filter._exact = {};
											dimension.filter._exact[fvalue] = 1;
										});
								// validateFilter(dimension); // we don't have to validate, because updateDimensions() validates filters as well
							}

							// recalculate pivot table
							updateDimensions();
							calculatePivotTable($this);
						});

					} else

					// if this is descendant of facts
					if ($data.has(this).length > 0) {
						var $fix = $('<div class="jqpivot-submenu-border-fix" />');
						var $menu = $('<div />', {
							'class': 'jqpivot-submenu',
							append: function() {
								var fname, f, $ret = $('<div />'), description;
								for (fname in $.jqpivot.functions) {
									f = $.jqpivot.functions[fname];
									description = f();
									$ret.append(
										$('<div />', {
											'class': 'jqpivot-submenu-function',
											html: '<span>(' + fname + ')</span>' + (description ? ' - ' + description : ''),
											click: setFactsFunctionEventListener
										}).data({
											name: fname,
											el: $dimension
										})
									);
								}
								return $ret;
							}
						});

						// append and show menu
						$dimension
							.append($fix)
							.append($menu);

						var menuWidth = $menu.outerWidth();
						$fix.width(Math.min(width, menuWidth) - 2).css({
							top: height - 1
						});
						$menu.css({
							top: height - 1,
							right: width <= menuWidth ? 'auto' : 0,
							left: width <= menuWidth ? left : 'auto'
						}).show();

					} else

					// if this is descendant of columns or rows
					if ($columns.add($rows).has(this).length > 0) {
						// set dimension sort order
						dimension.sort = dimension.sort === 'desc' ? 'asc' : 'desc';
						// recalculate pivot table
						updateDimensions();
						calculatePivotTable($this);
					}
				});

			}

			/**
			 * create little animation while data is loading
			 */
			function setLoading($this) {
				var intervalId,
				    symbols = ['.','..','...']; // ['/','-','\\','|']

				function animate(stop) {
					var $ani = $this.find('.jqpivot-loading > span');
					if ($ani.length === 0 || stop) {
						if (stop)
							$ani.text('...');
						return window.clearInterval(intervalId);
					}
					var text = $ani.text(),
					    i = symbols.indexOf(text) + 1;
					$ani.text(symbols[i >= symbols.length ? 0 : i]);
				}

				$this.html('<div class="jqpivot-loading">loading data <span>...</span></div>');
				animate();
				intervalId = window.setInterval(animate, 150);
				window.setTimeout(function() { animate(true) }, 30000); // clear interval and stop animation after 30 seconds
			}

			// *** public methods ***

			var methods = {

				// init plugin
				init: function(settings) {
					return this.each(function() {
						var $this = $(this),
						    jqpivot = $this.data('jqpivot');

						// if plugin already initialized on this element - do nothing
						if (jqpivot)
							return;

						// generate configuration
						var config = $.extend({}, $.jqpivot.defaults, settings);

						setLoading($this);
						initData(config.data, function(data) {
							if (data === undefined || data.length === 0 || !$.isPlainObject(data[0]) || $.isEmptyObject(data[0])) {
								$this.html('<div class="jqpivot-error">inappropriate data</div>');
								$.error('inappropriate data');
							}

							// recognize dimensions
							var d = normalizeDimensions($.extend(true, {
								dimensions: recognizeDimensions(data),
								columns: [], // e.g. ['qwe']
								rows: [], // e.g. ['asd']
								facts: [] // e.g. [{ by: 'zxc', func: 'sum' }]
							},{
								dimensions: config.dimensions,
								columns:    config.columns,
								rows:       config.rows,
								facts:      config.facts
							}), config);

							$this.data('jqpivot', {
								config: config,
								data: data,
								d: d
							});

							// create dom elements
							createDOM($this, d, config);
							calculatePivotTable($this);

						});
					});
				},

				// set columns on pivot table
				setColumns: function() {
					// if no arguments - do nothing
					if (arguments.length === 0)
						return this;

					var columns;
					if ($.isArray(arguments[0]))
						columns = arguments[0];
					else
						columns = Array.prototype.slice.call(arguments);

					return this.each(function() {
						var $this = $(this),
						    jqpivot = $this.data('jqpivot');

						// if plugin is not initialized on this element - do nothing
						if (!jqpivot)
							return;

						// console.log(columns);
						//TODO
						//need updateDimensions(d) in sight
						//calculatePivotTable($this);

					});
				},

				// destroy plugin, remove data and clear parent element
				destroy: function() {
					return this.each(function() {
						var $this = $(this),
						    jqpivot = $this.data('jqpivot');

						// if plugin is not initialized on this element - do nothing
						if (!jqpivot)
							return;

						//$(window).unbind('.jqpivot');
						$this.removeData('jqpivot');
						$this.empty();
					});
				}
			};

			// main plugin constructor
			this.construct = function(arg) {
				if (methods[arg])
					return methods[arg].apply(this, Array.prototype.slice.call(arguments, 1));
				if (typeof arg === 'object' || !arg)
					return methods.init.apply(this, arguments);
				$.error('there is no method "' + arg + '"');
			};
		}
	});

	$.fn.extend({
		jqpivot: $.jqpivot.construct
	});

})(jQuery, window);
