browserify index.js -o bundle.js
postcss style.css -o style_prefixed.css -u autoprefixer
# browserify areas/index.js -o areas/bundle.js
# postcss areas/style.css -o areas/style_prefixed.css -u autoprefixer