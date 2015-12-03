$.ajaxSetup({async: false});

var map, points, info, bounds, data, codes = {}, meta, currentDate, loadedData = {};
var dateBegin = new Date('2015-11-16'), dateEnd, firstCsv = true, selectedPoint = false;

$.getJSON('http://ks-opendata-community.github.io/chimney/data/工廠清單.json', {}, function (p) {
    points = p;
});

$.getJSON('http://ks-opendata-community.github.io/chimney/data/項目代碼.json', {}, function (p) {
    $.each(p, function (k, v) {
        codes[v['ITEM']] = v;
    });
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
        marker.addListener('click', function (cp) {
            info.setContent(this.data['工廠']);
            info.open(map, this);
            $('#title').html(this.data['工廠']);
            map.setZoom(15);
            map.setCenter(this.getPosition());
            selectedPoint = this.data['管制編號'];
            showData(selectedPoint);
        });
        bounds.extend(geoPoint);
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
            data.sort(function (a, b) {
                return b[3] - a[3];
            });
        }
        if (false !== selectedPoint) {
            showData(selectedPoint);
        }
    }



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
        var contentText = '<table class="table table-bordered"><thead><tr>';
        contentText += '<th>管制點</th><th>管制項目</th><th>檢驗時間</th><th>檢驗數值</th></tr></thead>';
        contentText += '<tbody>';
        $.each(data, function (b, l) {
            if (l[0] === currentKey) {
                contentText += '<tr>';
                for (i in l) {
                    switch (i) {
                        case '0':
                            break;
                        case '2':
                            k = l[i].replace(' ', '');
                            contentText += '<td>' + codes[k].DESP + '(' + codes[k].ABBR + ')</td>';
                            break;
                        case '4':
                            contentText += '<td>' + l[i] + ' ' + codes[k].UNIT + '</td>';
                            break;
                        default:
                            contentText += '<td>' + l[i] + '</td>';
                    }
                }
                contentText += '<tr>';
            }
        });
        contentText += '</tbody></table>';
        $('#content').html(contentText);
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
        data.sort(function (a, b) {
            return b[3] - a[3];
        });
    });
}

google.maps.event.addDomListener(window, 'load', initialize);