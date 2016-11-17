var gulp = require("gulp");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

gulp.task("default", function () {
    var stream = tsProject.src().pipe(tsProject());
    stream.js.pipe(gulp.dest("src/pages"));
    
    return stream;
});