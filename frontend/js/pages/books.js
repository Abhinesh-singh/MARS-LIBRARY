window.Pages=window.Pages||{};
Pages.books=async function(page=1,search=''){
 const root=document.getElementById('page-content');root.innerHTML='<div class="loading">Loading books…</div>';
 const d=await Api.get(`/books?page=${page}&limit=10&search=${encodeURIComponent(search)}`);const rows=d.data||[],p=d.pagination||{};
 root.innerHTML=`<div class="page-heading"><div><h2>Books</h2><p>Manage your book catalogue and available copies.</p></div><button class="btn btn-primary" onclick="Pages.bookForm()"><i class="fas fa-plus"></i> Add book</button></div>
 <div class="toolbar"><input id="book-search" placeholder="Search title, author or ISBN…" value="${UI.escape(search)}"><button class="btn btn-outline" onclick="Pages.books(1,document.getElementById('book-search').value)"><i class="fas fa-search"></i> Search</button><button class="btn btn-outline" onclick="Pages.books()"><i class="fas fa-rotate"></i> Reset</button></div>
 <div class="table-card"><div class="table-wrap"><table><thead><tr><th>Book</th><th>ISBN</th><th>Category</th><th>Copies</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td><strong>${UI.escape(b.title)}</strong><br><span class="muted">${UI.escape(b.author)}</span></td><td>${UI.escape(b.isbn)}</td><td>${UI.escape(b.category_name||b.category||'—')}</td><td>${b.available_copies} / ${b.total_copies}</td><td>${Number(b.available_copies)>0?UI.badge('available'):UI.badge('unavailable')}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="Pages.bookForm(${b.id})" title="Edit"><i class="fas fa-pen"></i></button><button class="btn btn-danger btn-sm" onclick="Pages.deleteBook(${b.id})" title="Delete"><i class="fas fa-trash"></i></button></div></td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">No books found.</td></tr>'}</tbody></table></div><div class="pagination"><span>${p.total||rows.length} books · Page ${p.page||1} of ${p.totalPages||1}</span><div class="actions"><button class="btn btn-outline" ${page<=1?'disabled':''} onclick="Pages.books(${page-1},document.getElementById('book-search').value)">Previous</button><button class="btn btn-outline" ${page>=(p.totalPages||1)?'disabled':''} onclick="Pages.books(${page+1},document.getElementById('book-search').value)">Next</button></div></div></div>`;
};
Pages.bookForm=async function(id=null){
 const b=id?(await Api.get('/books/'+id)).data:null,cats=await UI.selectOptions('/categories',b?.category_id||'');
 UI.openModal(id?'Edit book':'Add book',`<form id="book-form"><div class="modal-form-grid">
 <div class="form-group full"><label>Book title *</label><input name="title" required value="${UI.escape(b?.title||'')}"></div>
 <div class="form-group"><label>Author *</label><input name="author" required value="${UI.escape(b?.author||'')}"></div>
 <div class="form-group"><label>ISBN *</label><input name="isbn" required value="${UI.escape(b?.isbn||'')}"></div>
 <div class="form-group"><label>Category *</label><select name="category_id" required><option value="">Choose category</option>${cats}</select></div>
 <div class="form-group"><label>Total copies *</label><input type="number" min="1" name="total_copies" required value="${b?.total_copies||1}"></div>
 <div class="form-group"><label>Published year</label><input type="number" min="1000" max="${new Date().getFullYear()}" name="published_year" value="${b?.published_year||''}"></div>
 <div class="form-group"><label>Publisher</label><input name="publisher" value="${UI.escape(b?.publisher||'')}"></div>
 </div></form>`,`<button class="btn btn-outline" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="Pages.saveBook(${id||'null'})">Save book</button>`);
};
Pages.saveBook=async function(id){
 const f=document.getElementById('book-form');if(!f.reportValidity())return;
 const o=Object.fromEntries(new FormData(f));o.category_id=Number(o.category_id);o.total_copies=Number(o.total_copies);o.published_year=o.published_year?Number(o.published_year):null;
 await UI.run(async()=>{if(id){await Api.put('/books/'+id,o)}else{await Api.post('/books',o)}UI.closeModal();UI.toast('Book saved successfully');await Pages.books()});
};
Pages.deleteBook=async function(id){if(!confirm('Delete this book? This is only possible if it has no transaction history.'))return;await UI.run(async()=>{await Api.delete('/books/'+id);UI.toast('Book deleted');await Pages.books()})};
