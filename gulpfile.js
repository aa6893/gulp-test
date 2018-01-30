var gulp = require('gulp');
// watch = require('gulp-watch');
var $ = require('gulp-load-plugins')(); //簡化 gulp 載入流程，在有 gulp- 開頭的都不用 var 引用，只要在之後用到的部份加上 $. 即可
// var jade = require('gulp-jade'); // 此為被 gulp-load-plugins 取代後改為標註
// var sass = require('gulp-sass');
// var plumber = require('gulp-plumber'); //讓執行遇錯不中斷
// var postcss = require('gulp-postcss'); //postcss可載入大量插件，autoprefixer要有postcss才能使用
var autoprefixer = require('autoprefixer'); //自動前綴詞 -webkit-
var mainBowerFiles = require('main-bower-files'); //前端套件管理
var browserSync = require('browser-sync').create();//自動執行更新網頁檔
var minimist = require('minimist');
var gulpSequence = require('gulp-sequence')

//start minimist 相關程式碼
var envOptions = {
  string: 'env',
  default: {env: 'develop'} //production or develop，命令提示字元中可用 gulp --env production 修改整體開發環境狀態參數，也可改個別任務 task 的 env，gulp sass --env production
}
var options = minimist(process.argv.slice(2), envOptions)
console.log(options)
//end minimist 相關程式碼

gulp.task('clean', function () { // gulp-clean 套件，用於刪除 public 與 .tmp 資料夾
    return gulp.src(['./.tmp', './public'], {read: false})
        .pipe($.clean());
});

// gulp.task('copyHTML', function(){
//  return gulp.src('./source/**/*.html')
//    .pipe(gulp.dest('./public/'))
// })

gulp.task('jade', function() {
  // var YOUR_LOCALS = {};
 
  gulp.src('./source/**/*.jade')
  	.pipe($.plumber())//防止錯誤中斷套件
    .pipe($.data(function(){
      var khData = require('./source/data/data.json');
      var menu = require('./source/data/menu.json');
      var source = {
        'khData':khData,
        'menu':menu
      };
      console.log('jade',source)
      return source;
    }))
    .pipe($.jade({
      // locals: YOUR_LOCALS
      pretty: true
    }))
    .pipe(gulp.dest('./public/'))
    .pipe(browserSync.stream());// browser-sync 的重新整理
});

gulp.task('sass', function () {
	var plugins = [//postcss
        autoprefixer({browsers: ['last 1 version']}),/*autoprefixer，參數
https://github.com/ai/browserslist*/
        // cssnano()
    ];
  return gulp.src('./source/scss/**/*.scss')
  	.pipe($.plumber())
  	.pipe($.sourcemaps.init())// 產生 .map 檔，也可以用在 js 上
    .pipe($.sass({
      outputStyle: 'nested',
      includePaths: ['./node_modules/bootstrap/scss','./vendors/bower_components/animate-sass'],//寫這段是為了可以在 all.scss 中引用 @import "bootstrap"; 來載入外部資源
    })
      .on('error', $.sass.logError))
    // sass 編譯完成
    .pipe($.postcss(plugins))//postcss
    .pipe($.if(options.env === 'production', $.cleanCss())) // 壓縮 css，minify-css 開發者不維護，所以改 clean-css (gulp-clean-css)，因為是 function 要記得後面加上()，另外因為要使用 gulp-load-plugins 插件，所以不能有 - 要以大寫來表示
    //if 是 gulp-if 套件，用來判斷是 production 或者是 develop 來判斷要不要壓縮
    .pipe($.sourcemaps.write('.'))// 產生 .map 檔，也可以用在 js 上
    .pipe(gulp.dest('./public/css'))
    .pipe(browserSync.stream());
});

gulp.task('babel', () => { //es6轉譯
  return gulp.src('./source/js/**/*.js')
    .pipe($.sourcemaps.init())// 產生 .map 檔，也可以用在 css 上，使用 sourcemaps 後 chrome devtootls 裡才會指出未合併前的檔案對應
    .pipe($.babel({
        presets: ['es2015']//ES6的2015版本，要寄得安裝 babel-preset-es2015 套件才能執行，不然編譯會有錯誤
    }))
    .pipe($.concat('all.js'))// concat 合併多個 js 檔案成 all.js
    .pipe($.if(options.env === 'production', $.uglify({ // gulp-uglify 壓縮 js 套件
    //if 是 gulp-if 套件，用來判斷是 production 或者是 develop 來判斷要不要壓縮
      compress:{
        drop_console: true // 可以過濾掉 console.log() 的測式碼
      }
    })))
    .pipe($.sourcemaps.write('.'))// 產生 .map 檔，也可以用在 css 上
    .pipe(gulp.dest('./public/js'))
    .pipe(browserSync.stream());
});

gulp.task('bower', function() {
  return gulp.src(mainBowerFiles({
    "overrides":{ //當使用 vue 時要加入這段，讓 bower 能正確取用 vue.js，因為不是所有的套件都能夠很友善的給 bower 讀取
      "vue":{
        "main":"dist/vue.js"
      }
    }
  }))
    .pipe(gulp.dest('./.tmp/vendors'))//把前端套件載入這個路徑中
});

gulp.task('vendorJs', ['bower'], function(){//['bower']這寫法會讓 bower 先跑完才跑 vendorJs ，這樣 default 中就不用加入 bower 的 task
  return gulp.src([
      './.tmp/vendors/**/**.js',
      './node_modules/bootstrap/dist/js/bootstrap.bundle.min.js' // 此段如果不需要 bs4 的話可以先移除
    ])
    .pipe($.order([
      'jquery.js',
      'bootstrap.js'
    ]))
    .pipe($.concat('vendors.js'))//gulp-concat 套件把前端套件合併成 vendors.js 檔案
    .pipe($.if(options.env === 'production', $.uglify())) // gulp-uglify 壓縮 js 套件
    //if 是 gulp-if 套件，用來判斷是 production 或者是 develop 來判斷要不要壓縮
    .pipe(gulp.dest('./public/js'))
});

gulp.task('browser-sync', function() {
    browserSync.init({
        server: {
            baseDir: "./public"
        }
        //reloadDebounce: 2000 //大專案重整次數太多時可調整重整次數，選用，記得要增的的時候要加物件的分隔符號 ,
    });
});

gulp.task('image-min', () => //圖片壓縮，使用 gulp-imagemin
    gulp.src('./source/images/*')
        .pipe($.if(options.env === 'production', $.imagemin()))
        //if 是 gulp-if 套件，用來判斷是 production 或者是 develop 來判斷要不要壓縮，圖片壓縮時間比較長，所以要判斷
        .pipe(gulp.dest('./public/images'))
);

gulp.task('watch', function () { // 監控，當檔案變動執行相對任務名稱
  gulp.watch('./source/scss/**/*.scss', ['sass']);
  gulp.watch('./source/*.jade', ['jade']);
  gulp.watch('./source/js/**/*.js', ['babel']);  
});

// 指令題示視窗中打 gulp deploy 命令就可部屬到 Github Pages，使用 gulp-gh-pages 套件
// gulp.task('deploy', function() {
//   return gulp.src('./public/**/*')
//     .pipe($.ghPages());
// });

gulp.task('build', gulpSequence('clean', 'jade', 'sass', 'babel', 'vendorJs'))// 交附檔案用，使用 gulp-sequence 套件，主要是要把 gulp-clean 排序在最前面執行用的，gulp build --env production 壓縮給檔，或 gulp build --env develop 不壓縮給檔

gulp.task('default', ['jade', 'sass', 'babel', 'vendorJs', 'browser-sync', 'image-min', 'watch']); //合併任務，執行只要打gulp，開發階段使用