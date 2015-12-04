$.ajaxSetup({async: false});

var map, points, info, bounds, data, codes = {}, meta, currentDate, loadedData = {};
var dateBegin = new Date('2015-11-16'), dateEnd, firstCsv = true, selectedPoint = false;
var standards = {}, markers = {}, overlays = [];

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

loadCsv('http://ks-opendata-community.github.io/chimney/data/daily/latest.csv');

function initialize() {
    /*map setting*/
    $('#map-canvas').height(window.outerHeight / 2.2);

    map = new google.maps.Map(document.getElementById('map-canvas'), {
        zoom: 12,
        center: {lat: 22.672925, lng: 120.309465}
    });
    info = new google.maps.InfoWindow();
    bounds = new google.maps.LatLngBounds();

    $.each(points, function (k, p) {
        var geoPoint = (new google.maps.LatLng(parseFloat(p.Lat), parseFloat(p.Lng)));
        var marker = new google.maps.Marker({
            position: geoPoint,
            map: map,
            title: p['工廠']
        });
        marker.data = p;
        marker.addListener('click', function () {
            info.setContent(this.data['工廠']);
            info.open(map, this);
            $('#title').html(this.data['工廠']);
            map.setZoom(15);
            map.setCenter(this.getPosition());
            selectedPoint = this.data['管制編號'];
            showData(selectedPoint);
        });
        markers[p['管制編號']] = marker;
        bounds.extend(geoPoint);

        var ibLabel = new InfoBox({
            content: p['工廠'],
            position: geoPoint,
            boxClass: 'labelPoint',
            closeBoxURL: '',
            pixelOffset: new google.maps.Size(-25, 0)
        });
        overlays.push(ibLabel);
    });

    google.maps.event.addListener(map, 'zoom_changed', function () {
        var zoomLevel = map.getZoom();
        if (zoomLevel < 12) {
            $.each(overlays, function (i, v) {
                if (v instanceof InfoBox) {
                    v.setMap(null);
                }
            });
        } else {
            $.each(overlays, function (i, v) {
                if (v instanceof InfoBox) {
                    v.setMap(map);
                }
            });
        }
    });

    map.fitBounds(bounds);

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
        var c = getDateStr(currentDate);
        $('input#selectDate').val(c);
        if (!loadedData[c]) {
            var dateParts = c.split('-');
            var csvUrl = 'http://ks-opendata-community.github.io/chimney/data/daily/' + dateParts[0] + '/' + dateParts[1] + '/' + dateParts[0] + dateParts[1] + dateParts[2] + '.csv';
            loadCsv(csvUrl);
        } else {
            data = loadedData[c].slice(0);
            meta = data[0];
            currentDate = new Date(meta[0]);
            $('input#selectDate').val(meta[0]);
        }
        if (false !== selectedPoint) {
            showData(selectedPoint);
        }
    }

    $('select#chartFilter').change(function () {
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
        var contentText = '';
        var chartData = {}, defaultChartTypes = ['911', '922', '923', '926'];
        var chartType = $('select#chartFilter').val();
        if (!chartType) {
            chartType = 'default';
        }
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
                        contentText += '<div id="' + chartKey + '" style="height: 400px; margin: 0 auto">' + chartKey + '</div>';
                    }
                    if (!chartData[chartKey][line[1]]) {
                        chartData[chartKey][line[1]] = {};
                    }
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
                    var chartLine = {
                        name: p,
                        data: []
                    };
                    for (t in chartData[k][p]) {
                        chartLine.data.push(chartData[k][p][t]);
                    }
                    if (false === firstPoint) {
                        firstPoint = true;
                        for (t in chartData[k][p]) {
                            categories.push(t);
                        }
                    }
                    chartLines.push(chartLine);
                }
                var subtitle = '';
                if (standards[currentKey][k]) {
                    subtitle = '<a class="pop-standard" href="#" data-id="' + currentKey + '" data-item="' + k + '">排放標準</a>';
                }
                $('#' + k).highcharts({
                    title: {text: codes[k].DESP + ' (' + codes[k].UNIT + ')'},
                    subtitle: {
                        align: 'right',
                        text: subtitle,
                        useHTML: true
                    },
                    xAxis: {
                        categories: categories
                    },
                    yAxis: {text: 'value'},
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


    }
}

function loadCsv(csvUrl) {
    $.get(csvUrl, {}, function (p) {
        data = $.csv.toArrays(p);
        meta = data[0];
        loadedData[meta[0]] = data.slice(0);
        currentDate = new Date(meta[0]);
        if (firstCsv) {
            firstCsv = false;
            dateEnd = new Date(meta[0]);
        }
        $('input#selectDate').val(meta[0]);
    });
}

google.maps.event.addDomListener(window, 'load', initialize);