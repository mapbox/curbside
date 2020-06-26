# npm run prep
sed "s/username/$1/g" ./prep/draft.json | sed "s/tilesetid/$2/g" > ./prep/recipe.json
# tilesets add-source $1 $2 ./prep/isochrones.geojson 
# tilesets create $1.$2 --recipe ./prep/recipe.json -n "$2"
# tilesets publish $1.$2

# echo geofence ID = $1.$2