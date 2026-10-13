import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Plus,
  MapPin,
  Settings2,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { branchApi, errorMessage } from "../../services/api";
import { useResource, useDebounced } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  Badge,
  Button,
  PageHeader,
  SearchBox,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Modal,
  FormError,
} from "../../components/ui";
import BranchForm from "./BranchForm";
export default function BranchesPage() {
  const { user } = useAuth(),
    toast = useToast(),
    canEdit = user.role === "LANDLORD";
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const debounced = useDebounced(search);
  const resource = useResource(
    () => branchApi.list({ search: debounced, status, page }),
    [debounced, status, page],
  );
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await branchApi.remove(deleting._id);
      toast("Đã xóa cơ sở");
      setDeleting(null);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Danh sách cơ sở"
        description="Chọn một cơ sở để quản lý phòng, hoặc cập nhật thông tin và giá dịch vụ."
        action={
          canEdit && (
            <Button onClick={() => setEditing({})}>
              <Plus size={18} />
              Thêm cơ sở
            </Button>
          )
        }
      />
      <section className="content-panel">
        <div className="panel-heading">
          <h2>
            <Building2 size={19} />
            Cơ sở / Nhà trọ{" "}
            {resource.data && (
              <span className="count-label">{resource.data.total}</span>
            )}
          </h2>
        </div>
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm theo tên cơ sở…"
          />
          <select
            aria-label="Trạng thái cơ sở"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
        {resource.loading ? (
          <LoadingState />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : !resource.data.items.length ? (
          <EmptyState
            title="Chưa có cơ sở phù hợp"
            description="Thêm cơ sở đầu tiên để bắt đầu quản lý phòng và hợp đồng."
            action={
              canEdit && (
                <Button onClick={() => setEditing({})}>
                  <Plus size={17} />
                  Thêm cơ sở
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="table-wrap branch-table">
              <table>
                <thead>
                  <tr>
                    <th>Cơ sở / Địa chỉ</th>
                    <th>Số tầng</th>
                    <th>Số phòng</th>
                    <th>Đang thuê</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((branch) => (
                    <tr key={branch._id}>
                      <td data-label="Cơ sở">
                        <div className="branch-identity">
                          <div className="branch-icon">
                            <Building2 size={27} />
                          </div>
                          <div>
                            <Link
                              className="branch-name"
                              to={`/rooms?branchId=${branch._id}`}
                            >
                              {branch.name}
                            </Link>
                            <p className="address">
                              <MapPin size={14} />
                              {branch.address?.fullAddress || "Chưa có địa chỉ"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td data-label="Số tầng">{branch.totalFloors}</td>
                      <td data-label="Số phòng">
                        <strong>{branch.roomStats.total}</strong>
                      </td>
                      <td data-label="Đang thuê">
                        <span className="rented-count">
                          {branch.roomStats.rented}
                        </span>
                        <small>/{branch.roomStats.total} phòng</small>
                      </td>
                      <td data-label="Trạng thái">
                        <Badge status={branch.status} />
                      </td>
                      <td data-label="Thao tác">
                        <div className="branch-row-actions">
                          <Link
                            className="button secondary compact"
                            to={`/rooms?branchId=${branch._id}`}
                          >
                            Xem phòng <ArrowRight size={15} />
                          </Link>
                          {canEdit && (
                            <>
                              <button
                                className="icon-button"
                                title="Cấu hình cơ sở"
                                aria-label={`Cấu hình ${branch.name}`}
                                onClick={() => setEditing(branch)}
                              >
                                <Settings2 size={18} />
                              </button>
                              <button
                                className="icon-button danger-text"
                                title="Xóa cơ sở"
                                aria-label={`Xóa ${branch.name}`}
                                onClick={() => {
                                  setDeleting(branch);
                                  setError("");
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...resource.data} onChange={setPage} />
          </>
        )}
      </section>
      {editing && (
        <BranchForm
          branch={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.reload();
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Xóa cơ sở?"
          subtitle={deleting.name}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="modal-copy">
            Cơ sở sẽ được ẩn khỏi danh sách. Hệ thống chỉ cho phép xóa khi không
            còn phòng đang quản lý; lịch sử được giữ lại.
          </p>
          <FormError error={error} />
          <footer className="modal-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Xác nhận xóa
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
