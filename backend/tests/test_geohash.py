from app.geohash import encode_geohash, decode_geohash, get_adjacent_geohashes, haversine_distance


def test_haversine_distance():
    # Distance between JFK Airport and Times Square NYC is ~20.8 km
    jfk_lat, jfk_lng = 40.6413, -73.7781
    times_square_lat, times_square_lng = 40.7580, -73.9855

    dist = haversine_distance(jfk_lat, jfk_lng, times_square_lat, times_square_lng)
    assert 20.0 <= dist <= 22.0


def test_encode_and_decode_geohash():
    lat, lng = 37.7749, -122.4194  # San Francisco
    gh = encode_geohash(lat, lng, precision=6)
    assert len(gh) == 6
    assert isinstance(gh, str)

    decoded_lat, decoded_lng = decode_geohash(gh)
    # Check bounding precision within ~0.05 degrees
    assert abs(lat - decoded_lat) < 0.05
    assert abs(lng - decoded_lng) < 0.05


def test_adjacent_geohashes():
    gh = "9q9hv8"
    neighbors = get_adjacent_geohashes(gh)

    # Should contain the original geohash plus adjacent neighbor cells (up to 9 total)
    assert gh in neighbors
    assert len(neighbors) <= 9
    assert len(neighbors) >= 4
