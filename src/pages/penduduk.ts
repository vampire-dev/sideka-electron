/// <reference path="../../typings/tsd.d.ts" />

var { Component } = require('@angular/core');
var path = require('path');
var fs = require('fs');
var $ = require('jquery');
var { remote, app, shell } = require('electron');
var jetpack = require('fs-jetpack');
var Docxtemplater = require('docxtemplater'); 
var Handsontable = require('./handsontablep/dist/handsontable.full.js');
var expressions = require('angular-expressions');

import { pendudukImporterConfig, Importer } from '../helpers/importer';
import { exportPenduduk } from '../helpers/exporter';
import dataapi from '../stores/dataapi';
import schemas from '../schemas';
import { initializeTableSearch, initializeTableCount, initializeTableSelected } from '../helpers/table';
import createPrintVars from '../helpers/printvars';
import DiffProps from '../helpers/diff';

window['jQuery'] = $;
require('./node_modules/bootstrap/dist/js/bootstrap.js');

var app = remote.app;
var hot;
var sheetContainer;
var emptyContainer;
var resultBefore=[];
window['app'] = app;

const init = () => {
    sheetContainer = document.getElementById('sheet');
    emptyContainer = document.getElementById('empty');
    window['hot'] = hot = new Handsontable(sheetContainer, {
        data: [],
        topOverlay: 34,

        rowHeaders: true,
        colHeaders: schemas.getHeader(schemas.penduduk),
        columns: schemas.penduduk,

        colWidths: schemas.getColWidths(schemas.penduduk),
        rowHeights: 23,
        
        columnSorting: true,
        sortIndicator: true,
        hiddenColumns: {indicators: true},
        
        renderAllRows: false,
        outsideClickDeselects: false,
        autoColumnSize: false,
        search: true,
        filters: true,
        contextMenu: ['undo', 'redo', 'row_above', 'remove_row'],
        dropdownMenu: ['filter_by_condition', 'filter_action_bar'],
    });
    
    var spanSelected = $("#span-selected")[0];
    initializeTableSelected(hot, 1, spanSelected);
    
    var spanCount = $("#span-count")[0];
    initializeTableCount(hot, spanCount);

    window.addEventListener('resize', function(e){
        hot.render();
    });
}

const showColumns = [      
        [],
        ["nik","nama_penduduk","tempat_lahir","tanggal_lahir","jenis_kelamin","pekerjaan","kewarganegaraan","rt","rw","nama_dusun","agama","alamat_jalan"],
        ["nik","nama_penduduk","no_telepon","email","rt","rw","nama_dusun","alamat_jalan"],
        ["nik","nama_penduduk","tempat_lahir","tanggal_lahir","jenis_kelamin","nama_ayah","nama_ibu","hubungan_keluarga","no_kk"],
        ["nik","nama_penduduk","kompetensi","pendidikan","pekerjaan","pekerjaan_ped"]
    ];

const spliceArray = function(fields, showColumns){
    var result=[];
    for(var i=0;i!=fields.length;i++){
        var index = showColumns.indexOf(fields[i]);
        if (index == -1) result.push(i);
    }
    return result;
}

@Component({
    selector: 'penduduk',
    templateUrl: 'templates/penduduk.html'
})
export default class PendudukComponent extends DiffProps{
    tableSearcher: any;
    importer: any;
    loaded: boolean;
    savingMessage: any;

    constructor(){
        super(app);
        this.loaded = false;
    }

    ngOnInit(){
        $("title").html("Data Penduduk - " +dataapi.getActiveAuth().desa_name);

        init(); 
        
        var inputSearch = document.getElementById("input-search");
        this.tableSearcher = initializeTableSearch(hot, document, inputSearch, null);
        
        this.hot = window['hot'];
        this.importer = new Importer(pendudukImporterConfig);
        var ctrl = this;
    
        var keyup = (e) => {
            //ctrl+s
            if (e.ctrlKey && e.keyCode == 83){
                ctrl.openSaveDiffDialog();
                e.preventDefault();
                e.stopPropagation();
            }
            //ctrl+p
            if (e.ctrlKey && e.keyCode == 80){
                ctrl.printSurat();
                e.preventDefault();
                e.stopPropagation();
            }
        }
        document.addEventListener('keyup', keyup, false);
    
        dataapi.getContent("penduduk", null, {data: []}, function(content){        
            var initialData = content.data;
            ctrl.initialData = JSON.parse(JSON.stringify(initialData));
            hot.loadData(initialData);
            setTimeout(function(){
                if(initialData.length == 0)
                    $(emptyContainer).removeClass("hidden");
                else 
                    $(sheetContainer).removeClass("hidden");
                hot.render();
                ctrl.loaded = true;
            },500);
        })
        
        this.initDiffComponent(false);
    }

    importExcel(){
        var files = remote.dialog.showOpenDialog();
        if(files && files.length){
            this.importer.init(files[0]);
            $("#modal-import-columns").modal("show");
        }
    }

    doImport(overwrite){
        $("#modal-import-columns").modal("hide");
        var objData = this.importer.getResults();
        
        var existing = overwrite ? [] : hot.getSourceData();
        var imported = objData.map(o => schemas.objToArray(o, schemas.penduduk));
        var data = existing.concat(imported);
        console.log(existing.length, imported.length, data.length);

        hot.loadData(data);
        $(emptyContainer).addClass("hidden");
        $(sheetContainer).removeClass("hidden");
        setTimeout(function(){
            hot.render();
        },500);
    }

    exportExcel(){
        var data = hot.getSourceData();
        exportPenduduk(data, "Data Penduduk");
    }

    filterContent(){ 
        var plugin = hot.getPlugin('hiddenColumns');        
        var value = $('input[name=btn-filter]:checked').val();   
        var fields = schemas.penduduk.map(c => c.field);
        var result = spliceArray(fields,showColumns[value]);

        plugin.showColumns(resultBefore);
        if(value==0)plugin.showColumns(result);
        else plugin.hideColumns(result);
        hot.render();
        resultBefore = result;
    }

    insertRow(){
        $(emptyContainer).addClass("hidden");
        $(sheetContainer).removeClass("hidden");
        hot.alter("insert_row", 0);
        hot.selectCell(0, 0, 0, 0, true);
    }

    saveContent(){
        $("#modal-save-diff").modal("hide");
        this.savingMessage = "Menyimpan...";
        var timestamp = new Date().getTime();
        var content = {
            timestamp: timestamp,
            data: hot.getSourceData()
        };
        var that = this;
        
        dataapi.saveContent("penduduk", null, content, function(err, response, body){
            that.savingMessage = "Penyimpanan "+ (err ? "gagal" : "berhasil");
            if(!err){
                that.initialData = JSON.parse(JSON.stringify(content.data));
                that.afterSave();
            }
            setTimeout(function(){
                that.savingMessage = null;
            }, 2000);
        });
        return false;
    }

    printSurat(){
        var selected = hot.getSelected();
        if(!selected)
            return;
        var fileName = remote.dialog.showSaveDialog({
            filters: [
                {name: 'Word document', extensions: ['docx']},
            ]
        });
        if(fileName){
            if(!fileName.endsWith(".docx"))
                fileName = fileName+".docx";

            var angularParser= function(tag){
                var expr=expressions.compile(tag);
                return {get:expr};
            }
            var nullGetter = function(tag, props) {
                return "";
            };
            var penduduk = schemas.arrayToObj(hot.getDataAtRow(selected[0]), schemas.penduduk);
            var content = fs.readFileSync(path.join(app.getAppPath(), "docx_templates","surat.docx"),"binary");
            dataapi.getDesa(function(desas){
                var auth = dataapi.getActiveAuth();
                var desa = desas.filter(d => d.blog_id == auth.desa_id)[0];
                var printvars = createPrintVars(desa);
                
                var doc=new Docxtemplater(content);
                doc.setOptions({parser:angularParser, nullGetter: nullGetter});
                doc.setData({penduduk: penduduk, vars: printvars});
                doc.render();

                var buf = doc.getZip().generate({type:"nodebuffer"});
                fs.writeFileSync(fileName, buf);
                shell.openItem(fileName);
            })
        }
    }
}