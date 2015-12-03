$.ajaxSetup({async: false});

var map, points, info, bounds, data, codes = {};

$.getJSON('http://ks-opendata-community.github.io/chimney/data/工廠清單.json', {}, function (p) {
    points = p;
});

$.getJSON('http://ks-opendata-community.github.io/chimney/data/項目代碼.json', {}, function (p) {
    $.each(p, function (k, v) {
        codes[v['ITEM']] = v;
    });
});

$.get('http://ks-opendata-community.github.io/chimney/data/daily/latest.csv', {}, function (p) {
    data = $.csv.toArrays(p);
    data.sort(function (a, b) {
        return b[3] - a[3];
    });
});

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
            var currentKey = this.data['管制編號'];
            var contentText = '<table class="table table-bordered"><thead><tr>';
            contentText += '<th>管制點</th><th>管制項目</th><th>檢驗時間</th><th>檢驗數值</th></tr></thead>';
            contentText += '<tbody>';
            $.each(data, function (b, l) {
                if (l[0] === currentKey) {
                    contentText += '<tr>';
                    for (i in l) {
                        switch(i) {
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
        });
        bounds.extend(geoPoint);
    });

    map.fitBounds(bounds);
}

google.maps.event.addDomListener(window, 'load', initialize);