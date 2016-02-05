$.ajaxSetup({async: false});

var map, points, info, bounds, data, codes = {}, meta, currentDate, loadedData = {};
var dateBegin = new Date('2015-11-16'), dateEnd, firstCsv = true, selectedPoint = false;
var standards = {}, markers = {}, markerClicked = false;

$.getJSON('http://ks-opendata-community.github.io/chimney/data/工廠清單.json', {}, function (p) {
    points = p;
});

$.getJSON('http://ks-opendata-community.github.io/chimney/data/項目代碼.json', {}, function (p) {
    $.each(p, function (k, v) {
        codes[v['ITEM']] = v;
    });
});

$.get('http://ks-opendata-community.github.io/chimney/data/警戒值.csv', {}, function (p) {
    var stack = $.csv.toArrays(p);
    stack.shift();
    /*
     * CNO,POLNO,ITEM,STD
     */
    for (i in stack) {
        if (!standards[stack[i][0]]) {
            standards[stack[i][0]] = {};
        }
        if (!standards[stack[i][0]][stack[i][2]]) {
            standards[stack[i][0]][stack[i][2]] = {};
        }
        standards[stack[i][0]][stack[i][2]][stack[i][1]] = stack[i][3];
        var itemKey = '9' + stack[i][2].slice(-2);
        if (!standards[stack[i][0]][itemKey]) {
            standards[stack[i][0]][itemKey] = {};
        }
        standards[stack[i][0]][itemKey][stack[i][1]] = stack[i][3];
    }
});

loadCsv('http://ks-opendata-community.github.io/chimney/data/daily/latest.csv', 'KHH');

function initialize() {
    var showChart = function (theDay, factoryId) {
        var dirtyDate = new Date(theDay);
        if (!isNaN(dirtyDate.getTime())) {
            currentDate = dirtyDate;
            if (markers[factoryId]) {
                new google.maps.event.trigger(markers[factoryId], 'click');
            }
        }
    };
    var routes = {
        '/:theDay/:factoryId': showChart
    };
    var router = Router(routes);

    /*map setting*/
    $('#map-canvas').height(window.outerHeight / 2.2);

    map = new google.maps.Map(document.getElementById('map-canvas'), {
        zoom: 12,
        center: {lat: 22.672925, lng: 120.309465}
    });
    info = new google.maps.InfoWindow();
    bounds = new google.maps.LatLngBounds();

    var pointSelectOptions = '<option value="">---請選擇---</option>';
    $.each(points, function (k, p) {
        var geoPoint = (new google.maps.LatLng(parseFloat(p.Lat), parseFloat(p.Lng)));
        var marker = new google.maps.Marker({
            position: geoPoint,
            map: map,
            title: p['工廠']
        });
        marker.data = p;
        marker.addListener('click', function () {
            var infoText = '<strong>' + this.data['工廠'] + '</strong>';
            infoText += '<br />管制編號: ' + this.data['管制編號'];
            infoText += '<br />地址: ' + this.data['地址'];
            info.setContent(infoText);
            info.open(map, this);
            map.setZoom(15);
            map.setCenter(this.getPosition());
            currentFactory = this.data;
            selectedPoint = this.data['管制編號'];
            updateData();
        });
        markers[p['管制編號']] = marker;
        bounds.extend(geoPoint);

        pointSelectOptions += '<option value="' + p['管制編號'] + '">' + p['工廠'] + '[' + p['管制編號'] + ']</option>';
    });
    $('#pointSelect').html(pointSelectOptions).select2();
    $('#pointSelect').change(function () {
        if (false === markerClicked) {
            var value = $(this).val();
            if (markers[value]) {
                new google.maps.event.trigger(markers[value], 'click');
            }
        }
    });

    map.fitBounds(bounds);
    router.init();

    $('a.bounds-reset').click(function () {
        map.fitBounds(bounds);
        return false;
    });

    $('a#btnPrevious').click(function () {
        currentDate.setDate(currentDate.getDate() - 1);
        if (currentDate.getTime() < dateBegin.getTime()) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        updateData();
        return false;
    });

    $('a#btnNext').click(function () {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getTime() > dateEnd.getTime()) {
            currentDate.setDate(currentDate.getDate() - 1);
        }
        updateData();
        return false;
    });

    $('input#selectDate').datepicker({
        dateFormat: 'yy-mm-dd',
        onSelect: function (txt) {
            var selectedDate = new Date(txt);
            if (selectedDate.getTime() >= dateBegin.getTime() && selectedDate.getTime() <= dateEnd.getTime()) {
                currentDate = selectedDate;
                updateData();
            } else {
                $('#content').html('選擇的日期沒有資料');
            }

        }
    });

    function updateData() {
        if (false === selectedPoint) {
            return;
        }
        var c = getDateStr(currentDate);
        var city = markers[selectedPoint].data['city'];
        $('input#selectDate').val(c);
        if (!loadedData[city]) {
            loadedData[city] = {};
        }
        if (!loadedData[city][c]) {
            var dateParts = c.split('-');
            var csvUrl = 'http://ks-opendata-community.github.io/chimney/data/daily/';
            switch (city) {
                case 'KHH':
                    csvUrl += 'kaohsiung/'
                    break;
                case 'TXG':
                    csvUrl += 'taichung/'
                    break;
                case 'ILA':
                    csvUrl += 'yilan/'
                    break;
                case 'CYQ':
                    csvUrl += 'chiayi/'
                    break;
                case 'TNN':
                    csvUrl += 'tainan/'
                    break;
                case 'YUN':
                    csvUrl += 'yunlin/'
                    break;
                case 'CHA':
                    csvUrl += 'changhua/'
                    break;
            }
            csvUrl += dateParts[0] + '/' + dateParts[1] + '/' + dateParts[0] + dateParts[1] + dateParts[2] + '.csv';
            loadCsv(csvUrl, city);
        } else {
            data = loadedData[city][c].slice(0);
            meta = data[0];
            currentDate = new Date(meta[0]);
            $('input#selectDate').val(meta[0]);
        }
        if (false !== selectedPoint) {
            showData(selectedPoint);
            window.location.hash = '#' + c + '/' + selectedPoint;
            $('#title').html(markers[selectedPoint].data['工廠']);

            markerClicked = true;
            $('#pointSelect').val(selectedPoint).trigger('change');
            markerClicked = false;
        }
    }

    $('select#chartFilter').select2().change(function () {
        if (false !== selectedPoint) {
            showData(selectedPoint);
        }
    });

    function getDateStr(dateObj) {
        var m = dateObj.getMonth() + 1;
        var d = dateObj.getDate();
        m = m.toString();
        d = d.toString();
        m = m.length > 1 ? m : '0' + m;
        d = d.length > 1 ? d : '0' + d;
        return dateObj.getFullYear() + '-' + m + '-' + d;
    }

    function showData(currentKey) {
        $('#tab-block').show();
        var contentText = '';
        var chartData = {}, defaultChartTypes = ['911', '922', '923', '926'];
        var chartType = $('select#chartFilter').val();
        if (!chartType) {
            chartType = 'default';
        }
        var titleText = markers[currentKey].data['工廠'];
        /*
         * 0: 工廠代號
         * 1: 管制點 [2]
         * 2: 管制項目 [1] - chartKey
         * 3: 時間 [3]
         * 4: 數值 [4]
         */
        $.each(data, function (b, line) {
            if (line[0] === currentKey) {
                var chartCheck = true;
                switch (chartType) {
                    case 'default':
                        if (-1 === defaultChartTypes.indexOf(line[2])) {
                            chartCheck = false;
                        }
                        break;
                    case 'avg':
                        if (line[2].substr(0, 1) !== '2') {
                            chartCheck = false;
                        }
                        break;
                    case 'real':
                        if (line[2].substr(0, 1) !== '9') {
                            chartCheck = false;
                        }
                        break;
                }
                if (chartCheck) {
                    var chartKey = line[2];
                    if (!chartData[chartKey]) {
                        chartData[chartKey] = {};
                        contentText += '<div id="' + chartKey + '" class="chartBlock">' + chartKey + '</div>';
                    }
                    if (!chartData[chartKey][line[1]]) {
                        chartData[chartKey][line[1]] = {};
                    }
                    line[3] = '' + line[3];
                    chartData[chartKey][line[1]][line[3]] = parseFloat(line[4]);
                }

            }
        });
        var placeHolderCheck = true;
        if (contentText === '') {
            contentText = '<h3>選擇的管制點沒有圖表可以顯示，可以試著從右邊地圖下方的選單調整圖表過濾規則顯示</h3>';
            placeHolderCheck = false;
        }
        $('#content').html(contentText);

        if (placeHolderCheck) {
            for (k in chartData) {
                var chartLines = [], categories = [];
                var firstPoint = false;
                for (p in chartData[k]) {
                    var tkeys = [];
                    var chartLine = {
                        name: p,
                        data: []
                    };
                    for (t in chartData[k][p]) {
                        tkeys.push(t);
                    }
                    tkeys.sort();
                    for (i in tkeys) {
                        var t = tkeys[i];
                        chartLine.data.push(chartData[k][p][t]);
                    }
                    if (false === firstPoint) {
                        firstPoint = true;
                        for (i in tkeys) {
                            var t = tkeys[i];
                            var ft = t.substr(0, 2) + ':' + t.substr(2, 2);
                            categories.push(ft);
                        }
                    }
                    chartLines.push(chartLine);
                }
                var subtitle = '';
                if (standards[currentKey] && standards[currentKey][k]) {
                    subtitle = '<a class="pop-standard" href="#" data-id="' + currentKey + '" data-item="' + k + '"> &gt; 排放標準</a>';
                }
                $('#' + k).highcharts({
                    title: {text: codes[k].DESP + ' (' + codes[k].UNIT + ')'},
                    subtitle: {
                        align: 'right',
                        text: subtitle,
                        useHTML: true
                    },
                    xAxis: {
                        title: {
                            text: titleText + ' @ ' + getDateStr(currentDate)
                        },
                        categories: categories
                    },
                    yAxis: {
                        title: {
                            text: codes[k].UNIT
                        }
                    },
                    series: chartLines
                });
            }

            $('.pop-standard').click(function () {
                var self = $(this), boxid = self.attr('data-id'), boxitem = self.attr('data-item');
                var txt = '<p>';
                for (k in standards[boxid][boxitem]) {
                    txt += k + ': ' + standards[boxid][boxitem][k] + ' ' + codes[boxitem].UNIT + '<br />';
                }
                txt += '</p>';
                $('#dialog').html(txt).dialog({
                    width: 500,
                    title: codes[boxitem].DESP + '排放標準 @ ' + markers[boxid]['data']['工廠']
                });
                return false;
            });
        }

        // getting reports from https://github.com/kiang/prtr.epa.gov.tw
        var prefix = currentKey.substr(0, 2);
        $.getJSON('http://kiang.github.io/prtr.epa.gov.tw/data/' + prefix + '/' + currentKey + '.json', {}, function (c) {
            var toHideReports = true;
            for (k in c['reports']) {
                $('#report-' + k).html('');
                if (c['reports'][k].length === 0) {
                    $('#menu-' + k).parent().hide();
                } else {
                    $('#menu-' + k).parent().show();
                    toHideReports = false;
                    var reportText = '';
                    c['reports'][k].sort(function (a, b) {
                        return new Date(b['UPDATETIME']).getTime() - new Date(a['UPDATETIME']).getTime();
                    });
                    reportText += '<h3>' + k + '</h3>';
                    for (j in c['reports'][k]) {
                        for (v in c['reports'][k][j]) {
                            if (c['reports'][k][j][v] === null) {
                                c['reports'][k][j][v] = '-';
                            }
                        }
                        reportText += '<table class="table table-bordered">';
                        switch (k) {
                            case 'PENALTY':
                                reportText += '<tr><td>裁處時間</td><td>' + c['reports'][k][j]['PENALTYDATE'] + '</td></tr>';
                                reportText += '<tr><td>裁處書字號</td><td>' + c['reports'][k][j]['COUNTYCODE'] + ' ' + c['reports'][k][j]['COUNTY'] + ' ' + c['reports'][k][j]['DOCUMENTNO'] + '</td></tr>';
                                reportText += '<tr><td>違反時間</td><td>' + c['reports'][k][j]['TRANSGRESSDATE'] + '</td></tr>';
                                reportText += '<tr><td>違反法令</td><td>' + c['reports'][k][j]['TRANSGRESSLAW'] + '</td></tr>';
                                reportText += '<tr><td>裁罰金額</td><td>' + c['reports'][k][j]['PENALTYMONEY'] + '</td></tr>';
                                reportText += '<tr><td>訴願</td><td>' + c['reports'][k][j]['ISPETITION'] + ' ' + c['reports'][k][j]['PETITIONAGENCY'] + +' ' + c['reports'][k][j]['PETITIONRESULTS'] + '</td></tr>';
                                reportText += '<tr><td>陳情結果</td><td>' + c['reports'][k][j]['APPEALRESCIND'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'AIR':
                                reportText += '<tr><td>申報時段</td><td>' + c['reports'][k][j]['STARTDATE'] + ' ~ ' + c['reports'][k][j]['ENDDATE'] + '</td></tr>';
                                reportText += '<tr><td>揮發性有機物</td><td>' + c['reports'][k][j]['EMIITEM1'] + ' ' + c['reports'][k][j]['ITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>粒狀污染物</td><td>' + c['reports'][k][j]['EMIITEM2'] + ' ' + c['reports'][k][j]['ITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>硫氧化物</td><td>' + c['reports'][k][j]['EMIITEM3'] + ' ' + c['reports'][k][j]['ITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>氮氧化物</td><td>' + c['reports'][k][j]['EMIITEM4'] + ' ' + c['reports'][k][j]['ITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>申報狀態</td><td>' + c['reports'][k][j]['PERSTATUS'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'WAT':
                                reportText += '<tr><td>申報時段</td><td>' + c['reports'][k][j]['EMISTARTDATE'] + ' ~ ' + c['reports'][k][j]['EMIENDDATE'] + '</td></tr>';
                                reportText += '<tr><td>放流口</td><td>' + c['reports'][k][j]['DISCHARGENO'] + '</td></tr>';
                                reportText += '<tr><td>檢測項目</td><td>' + c['reports'][k][j]['EMIITEMNAME'] + '</td></tr>';
                                reportText += '<tr><td>檢測數據</td><td>' + c['reports'][k][j]['EMIITEMVALUE'] + ' ' + c['reports'][k][j]['EMIITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>排放量</td><td>' + c['reports'][k][j]['EMIWATER'] + ' ' + c['reports'][k][j]['EMIWATERITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'WAS':
                                reportText += '<tr><td>申報時段</td><td>' + c['reports'][k][j]['EMIYEAR'] + ' / ' + c['reports'][k][j]['EMIMONTH'] + '</td></tr>';
                                reportText += '<tr><td>廢棄物名稱</td><td>' + c['reports'][k][j]['EMIITEMID'] + ' ' + c['reports'][k][j]['EMIITEMNAME'] + '</td></tr>';
                                reportText += '<tr><td>廢棄物清理方式</td><td>' + c['reports'][k][j]['CLEANCODE'] + ' ' + c['reports'][k][j]['CLEANNAME'] + '</td></tr>';
                                reportText += '<tr><td>產出申報量</td><td>' + c['reports'][k][j]['EMIITEMVALUE'] + ' ' + c['reports'][k][j]['EMIITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>申報狀態</td><td>' + c['reports'][k][j]['EMISTATUS'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'TOX':
                                reportText += '<tr><td>申報時段</td><td>' + c['reports'][k][j]['STARTDATE'] + ' ~ ' + c['reports'][k][j]['ENDDATE'] + '</td></tr>';
                                reportText += '<tr><td>申報類別</td><td>' + c['reports'][k][j]['TOXICTYPE'] + '</td></tr>';
                                reportText += '<tr><td>毒化物</td><td>' + c['reports'][k][j]['EMIITEMID'] + ' ' + c['reports'][k][j]['TOXICNAME'] + ' ' + c['reports'][k][j]['TOXICENGNAME'] + '</td></tr>';
                                reportText += '<tr><td>申報量</td><td>' + c['reports'][k][j]['EMIVALUE'] + ' ' + c['reports'][k][j]['ITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'METAL':
                                reportText += '<tr><td>檢測日期</td><td>' + c['reports'][k][j]['EXAMODIFYDATE'] + '</td></tr>';
                                reportText += '<tr><td>煙道編號</td><td>' + c['reports'][k][j]['EMICHIMNEY'] + '</td></tr>';
                                reportText += '<tr><td>污染物</td><td>' + c['reports'][k][j]['EXAMITEMNAME'] + '</td></tr>';
                                reportText += '<tr><td>檢測結果</td><td>' + c['reports'][k][j]['EXAMITEMVALUE'] + ' ' + c['reports'][k][j]['EXAMITEMUNIT'] + '</td></tr>';
                                reportText += '<tr><td>審查狀態／稽查結果</td><td>' + c['reports'][k][j]['EXAMSTATUS'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            case 'GREENHOUSE':
                                reportText += '<tr><td>申報年度</td><td>' + c['reports'][k][j]['YEAR'] + '</td></tr>';
                                reportText += '<tr><td>CO2</td><td>' + c['reports'][k][j]['CO2'] + '</td></tr>';
                                reportText += '<tr><td>CH4</td><td>' + c['reports'][k][j]['CH4'] + '</td></tr>';
                                reportText += '<tr><td>N2O</td><td>' + c['reports'][k][j]['N2O'] + '</td></tr>';
                                reportText += '<tr><td>HFCS</td><td>' + c['reports'][k][j]['HFCS'] + '</td></tr>';
                                reportText += '<tr><td>PFCS</td><td>' + c['reports'][k][j]['PFCS'] + '</td></tr>';
                                reportText += '<tr><td>SF6</td><td>' + c['reports'][k][j]['SF6'] + '</td></tr>';
                                reportText += '<tr><td>間接排放量</td><td>' + c['reports'][k][j]['INDIRECTEMI'] + '</td></tr>';
                                reportText += '<tr><td>排放總量</td><td>' + c['reports'][k][j]['TOTALEMI'] + '</td></tr>';
                                reportText += '<tr><td>自願揭露或法規規定</td><td>' + c['reports'][k][j]['ISVOLUNTARY'] + '</td></tr>';
                                reportText += '<tr><td>是否經查證</td><td>' + c['reports'][k][j]['ISCHECK'] + '</td></tr>';
                                reportText += '<tr><td>資料匯入日期</td><td>' + c['reports'][k][j]['UPDATETIME'] + '</td></tr>';
                                break;
                            default:
                            for (v in c['reports'][k][j]) {
                                reportText += '<tr>';
                                reportText += '<tr><td>' + v + '</td><td>' + c['reports'][k][j][v] + '</td></tr>';
                                reportText += '</tr>';
                            }
                        }
                        reportText += '</table><br />';
                    }
                    $('#report-' + k).html(reportText);
                }
            }
            if (toHideReports) {
                $('#reportDropdown').hide();
            } else {
                $('#reportDropdown').show();
            }
        });
    }
}

function loadCsv(csvUrl, city) {
    $.get(csvUrl, {}, function (p) {
        data = $.csv.toArrays(p);
        meta = data[0];
        if (!loadedData[city]) {
            loadedData[city] = {};
        }
        loadedData[city][meta[0]] = data.slice(0);
        currentDate = new Date(meta[0]);
        if (firstCsv) {
            firstCsv = false;
            dateEnd = new Date(meta[0]);
        }
        $('input#selectDate').val(meta[0]);
    });
}

google.maps.event.addDomListener(window, 'load', initialize);