import math

# Base32 character set used by standard Geohash
BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
BASE32_MAP = {char: i for i, char in enumerate(BASE32)}

# Direction neighbors for geohashes
NEIGHBORS = {
    "top": {
        "even": "2389b45671cdebcde", # dummy placeholder, we will use bit arithmetic for neighbors
    }
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth in kilometers using Haversine formula.
    """
    R = 6371.0  # Earth's radius in km

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def encode_geohash(lat: float, lng: float, precision: int = 6) -> str:
    """
    Encodes latitude and longitude into a geohash string of given precision.
    Precision 6 corresponds to a cell size of ~1.2 km x 0.6 km.
    """
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]

    geohash = []
    bits = 0
    bit_count = 0
    even_bit = True

    while len(geohash) < precision:
        if even_bit:
            # Longitude mid calculation
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                bits = (bits << 1) | 1
                lng_range[0] = mid
            else:
                bits = (bits << 1) | 0
                lng_range[1] = mid
        else:
            # Latitude mid calculation
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                bits = (bits << 1) | 1
                lat_range[0] = mid
            else:
                bits = (bits << 1) | 0
                lat_range[1] = mid

        even_bit = not even_bit
        bit_count += 1

        if bit_count == 5:
            geohash.append(BASE32[bits])
            bits = 0
            bit_count = 0

    return "".join(geohash)


def decode_geohash(geohash: str) -> tuple[float, float]:
    """
    Decodes a geohash string into (latitude, longitude) center coordinates.
    """
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    even_bit = True

    for char in geohash:
        cd = BASE32_MAP.get(char, 0)
        for mask in [16, 8, 4, 2, 1]:
            bit = (cd & mask) >> (4 if mask == 16 else 3 if mask == 8 else 2 if mask == 4 else 1 if mask == 2 else 0)
            bit = 1 if (cd & mask) else 0

            if even_bit:
                mid = (lng_range[0] + lng_range[1]) / 2
                if bit:
                    lng_range[0] = mid
                else:
                    lng_range[1] = mid
            else:
                mid = (lat_range[0] + lat_range[1]) / 2
                if bit:
                    lat_range[0] = mid
                else:
                    lat_range[1] = mid

            even_bit = not even_bit

    lat = (lat_range[0] + lat_range[1]) / 2
    lng = (lng_range[0] + lng_range[1]) / 2
    return lat, lng


def get_adjacent_geohashes(geohash: str) -> list[str]:
    """
    Returns the target geohash plus its surrounding 8 neighboring grid cells.
    Calculates cell coordinates and samples neighboring coordinates to construct neighbors.
    """
    if not geohash:
        return []

    lat, lng = decode_geohash(geohash)
    precision = len(geohash)

    # Approximate lat/lng delta for precision level
    # Precision 6 ~ 0.01 degrees lat, 0.01 degrees lng
    # Scale delta with precision
    lat_delta = 180.0 / (2 ** (precision * 5 // 2))
    lng_delta = 360.0 / (2 ** ((precision * 5 + 1) // 2))

    neighbors = set()
    neighbors.add(geohash)

    # Offsets for 8 surrounding direction cells (-1, 0, 1)
    for d_lat in [-1, 0, 1]:
        for d_lng in [-1, 0, 1]:
            sample_lat = max(-89.9, min(89.9, lat + d_lat * lat_delta * 1.2))
            sample_lng = max(-179.9, min(179.9, lng + d_lng * lng_delta * 1.2))
            neighbor_hash = encode_geohash(sample_lat, sample_lng, precision)
            neighbors.add(neighbor_hash)

    return list(neighbors)
